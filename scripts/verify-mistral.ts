import { chatCompletion } from "../lib/mistral";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Starting Mistral Verification...");

    const API_KEY = process.env.MISTRAL_API_KEY;

    if (!API_KEY) {
        console.error("❌ Missing Environment Variable: MISTRAL_API_KEY");
        console.log("Since the app now uses In-App Setup (Cookies), these scripts require a .env.local file to function.");
        console.log("Please create a .env.local file with this variable just for this script.");
        process.exit(1);
    }

    try {
        console.log("Sending test prompt to Mistral...");
        const response = await chatCompletion("mistral-tiny", [
            { role: "user", content: "Say 'Hello from Mistral!' and nothing else." }
        ]);

        console.log("Response received:", response);

        if (response.includes("Hello from Mistral")) {
            console.log("✅ Mistral Verification Success!");
        } else {
            console.warn("⚠️ Response format check failed, but connection might be okay.");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
        process.exit(1);
    }
}

main();
