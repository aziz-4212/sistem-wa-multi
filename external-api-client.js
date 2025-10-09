const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

// Configuration
const BASE_URL = "http://localhost:5000";
const API_KEY = "whatsapp-api-key-2024";

class WhatsAppExternalAPI {
    constructor(baseUrl = BASE_URL, apiKey = API_KEY) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.headers = {
            "X-API-Key": apiKey,
        };
    }

    // Send text message
    async sendMessage(sessionId, to, message) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/send-message`,
                {
                    sessionId,
                    to,
                    message,
                },
                {
                    headers: {
                        ...this.headers,
                        "Content-Type": "application/json",
                    },
                }
            );
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Send media message
    async sendMedia(sessionId, to, filePath, message = "") {
        try {
            const formData = new FormData();
            formData.append("sessionId", sessionId);
            formData.append("to", to);
            formData.append("message", message);
            formData.append("file", fs.createReadStream(filePath));

            const response = await axios.post(
                `${this.baseUrl}/api/send-media`,
                formData,
                {
                    headers: {
                        ...this.headers,
                        ...formData.getHeaders(),
                    },
                }
            );
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Send broadcast message
    async sendBroadcast(
        sessionId,
        recipients,
        message,
        delay = 1000,
        filePath = null
    ) {
        try {
            const formData = new FormData();
            formData.append("sessionId", sessionId);
            formData.append("recipients", JSON.stringify(recipients));
            formData.append("message", message);
            formData.append("delay", delay.toString());

            if (filePath) {
                formData.append("file", fs.createReadStream(filePath));
            }

            const response = await axios.post(
                `${this.baseUrl}/api/broadcast`,
                formData,
                {
                    headers: {
                        ...this.headers,
                        ...formData.getHeaders(),
                    },
                }
            );
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Get session status
    async getSessionStatus(sessionId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/api/session/${sessionId}/status`,
                {
                    headers: this.headers,
                }
            );
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Get all sessions
    async getAllSessions() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/sessions`, {
                headers: this.headers,
            });
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Error handler
    handleError(error) {
        if (error.response) {
            return {
                success: false,
                error: error.response.data.error || "API Error",
                status: error.response.status,
            };
        } else if (error.request) {
            return {
                success: false,
                error: "No response from server",
                status: 0,
            };
        } else {
            return {
                success: false,
                error: error.message,
                status: 0,
            };
        }
    }
}

// Example usage
async function example() {
    const whatsappAPI = new WhatsAppExternalAPI();

    try {
        // 1. Check available sessions
        console.log("1. Getting all sessions...");
        const sessions = await whatsappAPI.getAllSessions();
        console.log("Sessions:", JSON.stringify(sessions, null, 2));

        if (!sessions.success || sessions.data.sessions.length === 0) {
            console.log(
                "No sessions available. Please create a session first."
            );
            return;
        }

        // Use first available session
        const sessionId = sessions.data.sessions[0].sessionId;
        console.log(`Using session: ${sessionId}`);

        // 2. Check session status
        console.log("\\n2. Checking session status...");
        const status = await whatsappAPI.getSessionStatus(sessionId);
        console.log("Status:", JSON.stringify(status, null, 2));

        if (!status.success || !status.data.isReady) {
            console.log("Session is not ready. Please authenticate first.");
            return;
        }

        // 3. Send text message
        console.log("\\n3. Sending text message...");
        const textResult = await whatsappAPI.sendMessage(
            sessionId,
            "6281234567890", // Replace with actual number
            "Hello from external system! This is a test message."
        );
        console.log(
            "Text message result:",
            JSON.stringify(textResult, null, 2)
        );

        // 4. Send broadcast message
        console.log("\\n4. Sending broadcast message...");
        const broadcastResult = await whatsappAPI.sendBroadcast(
            sessionId,
            ["6281234567890", "6281234567891"], // Replace with actual numbers
            "Broadcast message from external system!",
            2000 // 2 second delay
        );
        console.log(
            "Broadcast result:",
            JSON.stringify(broadcastResult, null, 2)
        );

        // 5. Send media message (uncomment if you have a file)
        /*
        console.log('\\n5. Sending media message...');
        const mediaResult = await whatsappAPI.sendMedia(
            sessionId,
            '6281234567890',
            './test-image.jpg', // Path to your test file
            'Check this image!'
        );
        console.log('Media message result:', JSON.stringify(mediaResult, null, 2));
        */
    } catch (error) {
        console.error("Example error:", error);
    }
}

// Run example if this file is executed directly
if (require.main === module) {
    example();
}

module.exports = WhatsAppExternalAPI;
