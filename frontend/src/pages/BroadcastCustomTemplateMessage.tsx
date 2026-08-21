import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  Table2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '../contexts/SessionContext';
import { sessionService } from '../services/api';

type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
  phoneValue: string;
  phoneNumber: string;
  generatedMessage: string;
};

type SendResult = {
  rowNumber: number;
  phoneNumber: string;
  phoneValue: string;
  status: 'success' | 'failed';
  error?: string;
  message: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_DELAY = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  return String(value).trim();
};

const normalizePhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = `62${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith('8')) {
    cleaned = `62${cleaned}`;
  }

  if (cleaned.startsWith('+62')) {
    cleaned = cleaned.slice(1);
  }

  if (!cleaned.startsWith('62') && cleaned.length > 0) {
    cleaned = `62${cleaned}`;
  }

  return cleaned;
};

const inferPhoneColumn = (headers: string[]): string => {
  const preferred = headers.find((header) => /(^|[\s_-])(phone|hp|nomor|no|wa)([\s_-]|$)/i.test(header));
  return preferred || headers[0] || '';
};

const buildMessage = (template: string, values: Record<string, string>, headers: string[]): string => {
  const sortedHeaders = [...headers].sort((a, b) => b.length - a.length);

  return sortedHeaders.reduce((current, header) => {
    if (!header) {
      return current;
    }

    const replacement = values[header] ?? '';
    return current.replace(new RegExp(escapeRegExp(header), 'g'), replacement);
  }, template);
};

const createUniqueHeaders = (rawHeaders: unknown[], dataRows: unknown[][]): string[] => {
  const maxColumns = Math.max(rawHeaders.length, ...dataRows.map((row) => row.length), 0);
  const counts = new Map<string, number>();

  return Array.from({ length: maxColumns }, (_, index) => {
    const rawHeader = normalizeCellValue(rawHeaders[index]);
    const fallback = index === 0 ? 'phone' : `header${index}`;
    const baseName = rawHeader || fallback;
    const currentCount = counts.get(baseName) || 0;
    counts.set(baseName, currentCount + 1);

    return currentCount === 0 ? baseName : `${baseName}_${currentCount + 1}`;
  });
};

const BroadcastCustomTemplateMessage: React.FC = () => {
  const { sessions } = useSession();
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [template, setTemplate] = useState('');
  const [delay, setDelay] = useState(DEFAULT_DELAY);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);

  const connectedSessions = sessions.filter((session) => session.isReady && session.status === 'connected');

  useEffect(() => {
    if (!selectedSessionId && connectedSessions.length > 0) {
      setSelectedSessionId(connectedSessions[0].id);
    }
  }, [connectedSessions, selectedSessionId]);

  const insertHeaderToken = (header: string) => {
    const textarea = templateTextareaRef.current;
    if (!textarea) {
      setTemplate((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${header}`);
      return;
    }

    const start = textarea.selectionStart ?? template.length;
    const end = textarea.selectionEnd ?? template.length;
    const nextValue = `${template.slice(0, start)}${header}${template.slice(end)}`;

    setTemplate(nextValue);

    window.requestAnimationFrame(() => {
      const cursor = start + header.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsReadingFile(true);
    setResults([]);
    setRows([]);
    setHeaders([]);
    setPhoneColumn('');
    setUploadedFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('No worksheet found in this file');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      }) as unknown[][];

      if (sheetRows.length < 2) {
        throw new Error('Excel file must contain a header row and at least one data row');
      }

      const parsedHeaders = createUniqueHeaders(sheetRows[0], sheetRows.slice(1));
      const parsedPhoneColumn = inferPhoneColumn(parsedHeaders);
      const dataRows = sheetRows.slice(1).filter((row) => row.some((cell) => normalizeCellValue(cell).length > 0));

      const parsedData: ParsedRow[] = dataRows.map((row, index) => {
        const values = parsedHeaders.reduce<Record<string, string>>((accumulator, header, columnIndex) => {
          accumulator[header] = normalizeCellValue(row[columnIndex]);
          return accumulator;
        }, {});

        const phoneValue = values[parsedPhoneColumn] || '';

        return {
          rowNumber: index + 2,
          values,
          phoneValue,
          phoneNumber: normalizePhoneNumber(phoneValue),
          generatedMessage: '',
        };
      });

      setHeaders(parsedHeaders);
      setPhoneColumn(parsedPhoneColumn);
      setRows(parsedData);

      toast.success(`Loaded ${parsedData.length} row(s) from ${file.name}`);
    } catch (error: any) {
      console.error('Failed to parse Excel file:', error);
      setUploadedFileName('');
      toast.error(error?.message || 'Failed to read Excel file');
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearUploadedFile = () => {
    setHeaders([]);
    setPhoneColumn('');
    setRows([]);
    setUploadedFileName('');
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const preparePreviewRows = (): ParsedRow[] => {
    return rows.map((row) => {
      const generatedMessage = buildMessage(template, row.values, headers);
      const phoneValue = row.values[phoneColumn] || row.phoneValue;

      return {
        ...row,
        phoneValue,
        phoneNumber: normalizePhoneNumber(phoneValue),
        generatedMessage,
      };
    });
  };

  const handleSend = async () => {
    if (!selectedSessionId) {
      toast.error('Please select a session');
      return;
    }

    if (!template.trim()) {
      toast.error('Please write the custom template message');
      return;
    }

    if (!headers.length || !rows.length) {
      toast.error('Please upload and parse an Excel file first');
      return;
    }

    const previewRows = preparePreviewRows();
    const validRows = previewRows.filter((row) => row.phoneNumber && row.generatedMessage.trim());

    if (validRows.length === 0) {
      toast.error('No valid recipient rows found');
      return;
    }

    setIsSending(true);
    setResults([]);
    setProgress({ current: 0, total: validRows.length });

    try {
      toast.loading(`Sending ${validRows.length} personalized message(s)...`, {
        id: 'template-broadcast',
      });

      const nextResults: SendResult[] = [];

      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];

        try {
          await sessionService.sendMessage({
            sessionId: selectedSessionId,
            to: row.phoneNumber,
            message: row.generatedMessage.trim(),
          });

          nextResults.push({
            rowNumber: row.rowNumber,
            phoneNumber: row.phoneNumber,
            phoneValue: row.phoneValue,
            status: 'success',
            message: row.generatedMessage.trim(),
          });
        } catch (error: any) {
          nextResults.push({
            rowNumber: row.rowNumber,
            phoneNumber: row.phoneNumber || row.phoneValue,
            phoneValue: row.phoneValue,
            status: 'failed',
            error: error?.response?.data?.error || error?.message || 'Failed to send message',
            message: row.generatedMessage.trim(),
          });
        }

        setResults([...nextResults]);
        setProgress({ current: index + 1, total: validRows.length });

        if (index < validRows.length - 1 && delay > 0) {
          await sleep(delay);
        }
      }

      const successCount = nextResults.filter((result) => result.status === 'success').length;
      const failedCount = nextResults.filter((result) => result.status === 'failed').length;

      if (failedCount === 0) {
        toast.success(`Template broadcast completed: ${successCount} sent`, {
          id: 'template-broadcast',
        });
      } else if (successCount > 0) {
        toast.success(`Completed with partial success: ${successCount} sent, ${failedCount} failed`, {
          id: 'template-broadcast',
        });
      } else {
        toast.error(`Template broadcast failed: ${failedCount} message(s) could not be sent`, {
          id: 'template-broadcast',
        });
      }
    } catch (error: any) {
      console.error('Template broadcast error:', error);
      toast.error(error?.response?.data?.error || 'Failed to send template broadcast', {
        id: 'template-broadcast',
      });
    } finally {
      setIsSending(false);
    }
  };

  const previewRows = preparePreviewRows();
  const successCount = results.filter((result) => result.status === 'success').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const activeSession = connectedSessions.find((session) => session.id === selectedSessionId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-whatsapp-green/10 p-3 text-whatsapp-green">
              <Table2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Broadcast Custom Template Message</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Upload an Excel file, map the phone column, write a template with custom headers, and send a personalized
                message to each row.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white px-3 py-1 font-medium text-gray-700 shadow-sm">
              Headers: {headers.length || 0}
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-gray-700 shadow-sm">
              Rows: {rows.length || 0}
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-gray-700 shadow-sm">
              Delay: {delay} ms
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Session</h2>
                <p className="text-sm text-gray-500">Choose a connected session before sending.</p>
              </div>
              <Users className="h-5 w-5 text-whatsapp-green" />
            </div>

            {connectedSessions.length === 0 ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                No connected sessions available. Please connect a session first.
              </p>
            ) : (
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              >
                <option value="">Choose a session...</option>
                {connectedSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.id}) - {session.phoneNumber || 'Connected'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Excel Upload</h2>
                <p className="text-sm text-gray-500">
                  First row is treated as headers. The selected phone column will be used as the recipient number.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file"
                />
                <label
                  htmlFor="excel-file"
                  className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isReadingFile ? 'Reading...' : 'Upload Excel'}
                </label>
              </div>
            </div>

            {uploadedFileName ? (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <span>
                  Loaded file: <span className="font-medium">{uploadedFileName}</span>
                </span>
                <button
                  type="button"
                  onClick={clearUploadedFile}
                  className="inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700"
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </button>
              </div>
            ) : null}

            {headers.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Phone column</label>
                  <select
                    value={phoneColumn}
                    onChange={(event) => setPhoneColumn(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                  >
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Detected headers</p>
                    <p className="text-xs text-gray-500">Click a header to insert it into the template</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {headers.map((header) => (
                      <button
                        key={header}
                        type="button"
                        onClick={() => insertHeaderToken(header)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          header === phoneColumn
                            ? 'bg-whatsapp-green text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {header}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Upload an Excel file to detect headers and preview personalized messages.
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Template Message</h2>
                <p className="text-sm text-gray-500">
                  Use the exact header names from Excel. Example: <span className="font-medium">halo header1, tanggal lahir anda header2</span>
                </p>
              </div>
              <Send className="h-5 w-5 text-whatsapp-green" />
            </div>

            <textarea
              ref={templateTextareaRef}
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              placeholder="halo header1, tanggal lahir anda header2"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
              <div className="flex flex-wrap gap-2">
                {headers.slice(0, 8).map((header) => (
                  <button
                    key={`template-chip-${header}`}
                    type="button"
                    onClick={() => insertHeaderToken(header)}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {header}
                  </button>
                ))}
              </div>
              <span>{template.length} characters</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Send Settings</h2>
                <p className="text-sm text-gray-500">Control delay between each message.</p>
              </div>
              <Clock className="h-5 w-5 text-whatsapp-green" />
            </div>

            <label className="mb-2 block text-sm font-medium text-gray-700">Delay between messages (ms)</label>
            <input
              type="number"
              value={delay}
              min="0"
              step="100"
              onChange={(event) => setDelay(Math.max(0, parseInt(event.target.value, 10) || 0))}
              className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
            />
            <p className="mt-2 text-xs text-gray-500">
              Use a small delay if you are sending many personalized messages.
            </p>

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !connectedSessions.length || !rows.length}
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-whatsapp-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-whatsapp-green-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Personalized Messages
                </>
              )}
            </button>

            {progress.total > 0 ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Progress</span>
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-whatsapp-green transition-all"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
              <p className="text-sm text-gray-500">Generated messages are previewed using the Excel values.</p>
            </div>

            {previewRows.length > 0 ? (
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {previewRows.slice(0, 5).map((row) => (
                  <div key={`${row.rowNumber}-${row.phoneNumber}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-gray-900">
                        Row {row.rowNumber}
                      </div>
                      <div className="text-xs font-mono text-gray-600">
                        {row.phoneNumber || row.phoneValue || 'No phone number'}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">
                      {row.generatedMessage || 'Template is empty or values are missing.'}
                    </p>
                  </div>
                ))}

                {previewRows.length > 5 ? (
                  <p className="text-center text-xs text-gray-500">Showing first 5 rows only.</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Upload the file and type a template to see the message preview here.
              </div>
            )}
          </div>
        </div>
      </div>

      {results.length > 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Send Results</h2>
              <p className="text-sm text-gray-500">Each row is sent separately so you can personalize the content.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">
                Success: {successCount}
              </span>
              <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
                Failed: {failedCount}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                Total: {results.length}
              </span>
            </div>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {results.map((result) => (
              <div
                key={`${result.rowNumber}-${result.phoneNumber}`}
                className={`flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:justify-between ${
                  result.status === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-semibold text-gray-900">Row {result.rowNumber}</span>
                    <span className="text-xs font-mono text-gray-600">{result.phoneNumber}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{result.message}</p>
                </div>

                <div className="text-sm">
                  {result.status === 'success' ? (
                    <span className="font-medium text-green-700">Sent</span>
                  ) : (
                    <span className="font-medium text-red-700">{result.error || 'Failed'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeSession ? (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Ready to send from <span className="font-semibold">{activeSession.name}</span>.
        </div>
      ) : null}
    </div>
  );
};

export default BroadcastCustomTemplateMessage;
