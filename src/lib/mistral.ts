import { Mistral } from "@mistralai/mistralai";
import { AppSettings } from "@/hooks/useSettings";

// ------------------------------------------------------------------
// Core Client
// ------------------------------------------------------------------

export const getMistralClient = (apiKey: string) => {
    if (!apiKey) return null;
    return new Mistral({ apiKey: apiKey.trim() });
};

export const fetchMistralModels = async (apiKey: string) => {
    const client = getMistralClient(apiKey);
    if (!client) return [];
    try {
        const response = await client.models.list();
        return response.data || [];
    } catch (error) {
        console.error("Failed to fetch models from Mistral API:", error);
        // Comprehensive Fallback List
        return [
            // General Purpose
            { id: "mistral-large-latest" },
            { id: "mistral-medium-latest" },
            { id: "mistral-small-latest" },

            // Open Source / Edge
            { id: "open-mistral-7b" },
            { id: "open-mixtral-8x7b" },
            { id: "open-mixtral-8x22b" },
            { id: "open-mistral-nemo" },

            // Coding Specialist
            { id: "codestral-latest" },

            // Specialized
            { id: "mistral-embed" },
            { id: "pixtral-12b-2409" },
            { id: "mistral-ocr-latest" },

            // Ministral
            { id: "ministral-3b-latest" },
            { id: "ministral-8b-latest" },

            // Audio / Video
            { id: "voxtral-mini-2507" },

            // Moderation
            { id: "mistral-moderation-latest" }
        ];
    }
};

// ------------------------------------------------------------------
// Advanced AI Pipelines
// ------------------------------------------------------------------

/**
 * Simple Transcription + Cleanup for Chat
 */
/**
 * Simple Transcription + Cleanup for Chat
 */
export const transcribeAndCleanup = async (audioBlob: Blob, apiKey: string, model: string = "mistral-small-latest") => {
    const client = getMistralClient(apiKey);
    if (!client) throw new Error("API Key missing");

    let text = "";
    try {
        const response = await client.audio.transcriptions.complete({
            file: audioBlob as any,
            model: model,
        });
        text = (response as any).text || "";
    } catch (e) {
        console.error("Transcription failed", e);
        return "";
    }

    if (!text) return "";

    try {
        const cleanup = await client.chat.complete({
            model: "mistral-small-latest",
            messages: [
                { role: "system", content: "Clean up this transcription. Fix punctuation, remove filler words, and correct phonetic errors. Output ONLY the cleaned text. Do not include any introductory text, output labels, or markdown code blocks." },
                { role: "user", content: text }
            ]
        });
        const content = cleanup.choices?.[0].message.content;
        return typeof content === 'string' ? content : text;
    } catch (e) {
        console.error("Cleanup failed", e);
        return text;
    }
};

/**
 * 1. Transcription Chain
 */
export const transcriptionChain = async (audioBlob: Blob, settings: AppSettings) => {
    return transcribeAndCleanup(audioBlob, settings.mistralApiKey, settings.aiFeatures.transcription.model);
};

/**
 * 2. Media Pipeline
 */
export const mediaUnderstanding = async (file: File | Blob, settings: AppSettings) => {
    const { mistralApiKey, aiFeatures } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) throw new Error("API Key missing");

    let resultText = "";
    const isImage = file.type.startsWith('image/');

    try {
        if (isImage) {
            const ocrResponse = await client.ocr.process({
                model: aiFeatures.media.ocrModel || "mistral-ocr-latest",
                document: {
                    type: "image_url",
                    imageUrl: URL.createObjectURL(file)
                } as any
            });
            const ocrMarkdown = (ocrResponse as any).pages?.map((p: any) => p.markdown).join("\n") || "";

            const vision = await client.chat.complete({
                model: aiFeatures.media.model || "pixtral-12b-2409",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Analyze this image. If it's a document, summarize its purpose. If it's a scene, describe it. Mention key subjects. Output ONLY the analysis text. Do not be conversational. Do not use code blocks." },
                            { type: "image_url", imageUrl: URL.createObjectURL(file) }
                        ]
                    }
                ]
            });
            const analysis = vision.choices?.[0].message.content || "";
            resultText = `### Media Analysis\n${analysis}\n\n### OCR Result\n${ocrMarkdown}`;
        }
    } catch (e) {
        console.error("Media processing failed", e);
    }

    return resultText;
};

/**
 * 3. Organization
 */
export const organizeContent = async (text: string, settings: AppSettings) => {
    const { mistralApiKey, aiFeatures } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.organization.model || "mistral-small-latest",
            messages: [
                {
                    role: "system",
                    content: `You are an expert note organizer. Reorganize the provided text into a clean, structured Markdown document.
                    - Use Markdown Headers (#, ##) for logical sections.
                    - Use bullet points for lists.
                    - Keep the original information intact.
                    - Output ONLY the raw Markdown content. 
                    - STRICTLY NO introductory text, no "Here is the organized note", and no markdown code blocks.`
                },
                { role: "user", content: text }
            ]
        });
        const content = res.choices?.[0].message.content;
        return typeof content === 'string' ? content : text;
    } catch {
        return text;
    }
};

/**
 * 4. Summarization
 */
export const summarizeHighlight = async (text: string, settings: AppSettings) => {
    const { mistralApiKey, aiFeatures } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.summarization.model || "mistral-large-latest",
            messages: [
                { role: "system", content: "Provide a concise, high-level summary of the following text in bullet points. Format the output as a Markdown blockquote starting with '> [!SUMM]'. Output ONLY the raw blockquote. Do NOT wrap in code blocks." },
                { role: "user", content: text }
            ]
        });
        let summary = typeof res.choices?.[0].message.content === 'string' ? res.choices[0].message.content : "";

        // Clean up if the model wraps in code blocks despite instructions
        summary = summary.replace(/^```markdown\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');

        // If model didn't add the header, add it manually
        if (!summary.includes("[!SUMM]")) {
            return `> [!SUMM]\n> ${summary.split('\n').join('\n> ')}\n\n${text}`;
        }

        return `${summary}\n\n${text}`;
    } catch {
        return text;
    }
};

/**
 * 5. Synthesis
 */
export const synthesizeNote = async (currentNote: string, newContext: string, mediaReff: string, settings: AppSettings): Promise<string> => {
    const { mistralApiKey } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) return currentNote + "\n\n" + newContext;

    try {
        const chat = await client.chat.complete({
            model: settings.selectedModel || "mistral-large-latest",
            messages: [
                {
                    role: "system",
                    content: `You are an expert note synthesizer. Merge the New Information into the Existing Note seamlessly. 
                    - Place the new info where it logically belongs (by topic).
                    - If the topic exists, enhance it.
                    - If it's new, add a new section.
                    - Insert the reference marker "[Reff: ${mediaReff}]" exactly where the new information is added.
                    - Maintain the existing style/markdown.
                    - Output ONLY the merged note content. Do not include any conversational filler or code blocks.`
                },
                {
                    role: "user",
                    content: `Existing Note:\n${currentNote}\n\nNew Information:\n${newContext}`
                }
            ]
        });
        const content = chat.choices?.[0].message.content;
        return typeof content === 'string' ? content : currentNote + "\n\n" + newContext;
    } catch (e) {
        console.error("Synthesis failed", e);
        return currentNote + "\n\n" + newContext + ` [Reff: ${mediaReff}]`;
    }
};
/**
 * 6. Live Grammar & Spelling
 */
export const applyGrammarAndSpelling = async (text: string, settings: AppSettings) => {
    const { mistralApiKey, aiFeatures } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.grammar.model || "mistral-small-latest",
            messages: [
                {
                    role: "system",
                    content: "Fix grammar, spelling, and punctuation in the following text. Do NOT change the style, tone, or formatting unless it's a clear error. Maintain all markdown structure. Output ONLY the corrected text. Do NOT wrap in code blocks. Do NOT include any intro/outro text."
                },
                { role: "user", content: text }
            ]
        });
        const content = res.choices?.[0].message.content;
        return typeof content === 'string' ? content : text;
    } catch {
        return text;
    }
};

/**
 * 7. Conversational Chat
 */
export const chatWithMistral = async (
    history: { role: 'user' | 'assistant'; content: string }[],
    currentDoc: string,
    settings: AppSettings
) => {
    const { mistralApiKey, selectedModel } = settings;
    const client = getMistralClient(mistralApiKey);
    if (!client) throw new Error("API Key missing");

    const systemPrompt = `You are an expert AI assistant integrated into a note-taking application.
    Current Note Content:
    ---
    ${currentDoc}
    ---
    Guidelines:
    - Reference the "Current Note Content" when relevant.
    - If the user asks to modify the note (rewrite, summarize, add details, etc.), YOU MUST provide the FULL NEW version of the content wrapped in <updated_note> content </updated_note> tags.
    - You can provide conversational explanation outside the tags.
    - Be concise but helpful.
    - Use Markdown for responses.`;

    try {
        const response = await client.chat.complete({
            model: selectedModel || "mistral-large-latest",
            messages: [
                { role: "system", content: systemPrompt },
                ...history
            ]
        });
        const content = response.choices?.[0].message.content;
        return typeof content === 'string' ? content : "";
    } catch (e) {
        console.error("Chat failed", e);
        throw e;
    }
};
