/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                whatsapp: {
                    green: "#25D366",
                    "green-dark": "#128C7E",
                    "green-light": "#DCF8C6",
                    blue: "#34B7F1",
                    gray: "#ECE5DD",
                    "gray-dark": "#3B4A54",
                },
            },
        },
    },
    plugins: [],
};
