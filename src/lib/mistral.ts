import { Mistral } from "@mistralai/mistralai";
import { AppSettings } from "@/hooks/useSettings";
import { config } from "./config";

// ------------------------------------------------------------------
// Core Client
// ------------------------------------------------------------------

export const getMistralClient = (apiKey?: string) => {
    const key = apiKey || config.mistralApiKey;
    if (!key) return null;
    return new Mistral({ apiKey: key.trim() });
};

export const fetchMistralModels = async (apiKey?: string) => {
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
export const transcribeAndCleanup = async (audioBlob: Blob, apiKey?: string, model: string = "mistral-small-latest") => {
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
                { role: "system", content: "You are an expert transcription editor. Clean up the provided text to be a coherent, polished note. Fix punctuation, remove filler words (um, ah, like), and correct phonetic errors. Keep the tone natural but professional. Output ONLY the cleaned text. Do not include any introductory text, output labels, or markdown code blocks." },
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
    return transcribeAndCleanup(audioBlob, undefined, settings.aiFeatures.transcription.model);
};

/**
 * 2. Media Pipeline
 */
export const mediaUnderstanding = async (file: File | Blob, settings: AppSettings) => {
    const { aiFeatures } = settings;
    const client = getMistralClient();
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
                            { type: "text", text: "Analyze this image. If it's a document, summarize its purpose. If it's a scene, describe it. Mention key subjects. \n- Format output as clean Markdown.\n- Use Headers (###) for sections.\n- Use bullet points for details.\n- Output ONLY the analysis text.\n- Do not be conversational.\n- Do not use code blocks." },
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
    const { aiFeatures } = settings;
    const client = getMistralClient();
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
                    - Keep all original information intact; do not summarize, just structure.
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
    const { aiFeatures } = settings;
    const client = getMistralClient();
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.summarization.model || "mistral-large-latest",
            messages: [
                { role: "system", content: "Provide a concise, high-level summary of the following text in bullet points. Format the output as a Markdown blockquote starting with '> [!SUMM]'. Output ONLY the raw blockquote. Do NOT wrap in code blocks or include any other text." },
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
    // const { mistralApiKey } = settings; // Removed
    const client = getMistralClient();
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
                    - Output ONLY the merged note content. 
                    - STRICTLY do not include any conversational filler or wrap the output in markdown code blocks (such as \`\`\`markdown).`
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
    const { aiFeatures } = settings;
    const client = getMistralClient();
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.grammar.model || "mistral-small-latest",
            messages: [
                {
                    role: "system",
                    content: "You are a fast, precise grammar assistant. Fix grammar, spelling, and punctuation errors in the text. \n- STRICTLY PRESERVE Markdown formatting (headers, bold, italics, links).\n- DO NOT change the writing style or tone.\n- DO NOT make optional stylistic changes; only fix objective errors.\n- Output ONLY the corrected text.\n- Do NOT wrap in code blocks.\n- Do NOT include any conversational filler."
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
    history: { role: 'user' | 'assistant' | 'tool'; content: string; tool_calls?: any[]; name?: string; tool_call_id?: string }[],
    currentDoc: string,
    settings: AppSettings
) => {
    const { selectedModel } = settings;
    const client = getMistralClient();
    if (!client) throw new Error("API Key missing");

    const tools = [
        {
            type: "function",
            function: {
                name: "read_active_note",
                description: "Read the content of the currently active note.",
                parameters: {
                    type: "object",
                    properties: {},
                },
            },
        },
        {
            type: "function",
            function: {
                name: "write_active_note",
                description: "Rewrite the active note with new content. This replaces the entire note.",
                parameters: {
                    type: "object",
                    properties: {
                        content: {
                            type: "string",
                            description: "The new content for the note. Must be full, valid Markdown.",
                        },
                    },
                    required: ["content"],
                },
            },
        },
    ];

    const systemPrompt = `You are an expert AI assistant integrated into a note-taking application.
    - You can read and write the active note using the provided tools.
    - When the user asks to edit, rewrite, or update the note, you MUST use the \`write_active_note\` tool.
    - If you use \`write_active_note\`, do not include the <updated_note> tags manually; the tool handles it.
    - Be concise but helpful.`;

    let currentMessages = [
        { role: "system", content: systemPrompt },
        ...history
    ];

    try {
        console.log("Sending chat request to Mistral...");
        const response = await client.chat.complete({
            model: selectedModel || "mistral-large-latest",
            messages: currentMessages as any,
            tools: tools as any,
            toolChoice: "auto",
        });

        const choice = response.choices?.[0];
        const message = choice?.message;

        // If no tool call, just return content
        if (!message?.toolCalls || message.toolCalls.length === 0) {
            return message?.content || "";
        }

        // Handle Tool Calls
        const toolCalls = message.toolCalls;
        currentMessages.push(message as any); // Add assistant's tool call request to history

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionArgs = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            let toolResult = "";

            if (functionName === "read_active_note") {
                console.log("Tool Call: reading active note");
                toolResult = currentDoc;
            } else if (functionName === "write_active_note") {
                console.log("Tool Call: writing active note");
                // We don't actually write here, we just return a success message
                // AND we will inject the <updated_note> tag in the final response 
                // so the UI picks it up.
                toolResult = "Note updated successfully.";

                // Hack: We append the diff tag to the FINAL response by forcing a follow-up
                // effectively "confirming" the action.
                // However, the tool result itself is just for the LLM's context.
            }

            currentMessages.push({
                role: "tool",
                name: functionName,
                content: toolResult,
                tool_call_id: toolCall.id,
            } as any);
        }

        // Second API call to get the final answer after tool execution
        const finalResponse = await client.chat.complete({
            model: selectedModel || "mistral-large-latest",
            messages: currentMessages as any,
            tools: tools as any,
            toolChoice: "auto",
        });

        const finalContent = finalResponse.choices?.[0].message.content || "";

        // If the tool was write_active_note, we need to append the <updated_note> tag 
        // if the model didn't do it (it shouldn't have, we told it not to).
        // Actually, let's look at the tool calls from the *previous* turn to see if we wrote.
        const wasWriteTriggered = toolCalls.some(tc => tc.function.name === "write_active_note");

        if (wasWriteTriggered) {
            // Find the content
            const writeCall = toolCalls.find(tc => tc.function.name === "write_active_note");
            if (writeCall) {
                const args = typeof writeCall.function.arguments === 'string'
                    ? JSON.parse(writeCall.function.arguments)
                    : writeCall.function.arguments;
                const newContent = args.content;
                // Append the magic tag hiddenly or explicitly
                return `${finalContent}\n\n<updated_note>${newContent}</updated_note>`;
            }
        }

        return finalContent;

    } catch (e) {
        console.error("Chat failed", e);
        throw e;
    }
};
