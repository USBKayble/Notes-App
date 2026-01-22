import { Mistral } from "@mistralai/mistralai";
import { getConfig } from "./session";

async function getClient() {
    const config = await getConfig();
    if (!config?.mistral?.apiKey) {
        throw new Error("Mistral Not Configured");
    }
    return new Mistral({ apiKey: config.mistral.apiKey });
}

export async function chatCompletion(model: string, messages: any[], temperature: number = 0.7) {
    try {
        const client = await getClient();
        const response = await client.chat.complete({
            model: model || "mistral-large-latest",
            messages,
            temperature,
        });

        const content = response.choices?.[0]?.message?.content;

        // Handle array content (multimodal) if necessary, or just return string
        if (Array.isArray(content)) {
            return content.map(c => (typeof c === 'string' ? c : (c as any).text || '')).join('');
        }

        return content || "";
    } catch (error) {
        console.error("Mistral Chat Error:", error);
        throw error;
    }
}
