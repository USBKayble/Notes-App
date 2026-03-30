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
            file: audioBlob as File,
            model: model,
        });

        text = response.text || "";
    } catch (e) {
        console.error("Transcription failed", e);
        return "";
    }

    if (!text) return "";

    try {
        const cleanup = await client.chat.complete({
            model: "mistral-small-latest",
            messages: [
                { role: "system", content: "Clean up transcription. Fix punctuation, spelling, remove filler words, and correct phonetic errors. Keep original tone. LaTeX: $ for inline, $$ for block. Output ONLY cleaned text." },
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

export interface MediaUnderstandingResult {
    description: string;
    ocrMarkdown: string;
    combined: string;
}

/**
 * 2. Media Pipeline
 */
export const mediaUnderstanding = async (file: File | Blob, settings: AppSettings): Promise<MediaUnderstandingResult | null> => {
    const { aiFeatures } = settings;
    const client = getMistralClient();
    if (!client) throw new Error("API Key missing");

    const isImage = file.type.startsWith('image/');

    try {
        if (isImage) {
            const ocrResponse = await client.ocr.process({
                model: aiFeatures.media.ocrModel || "mistral-ocr-latest",
                document: {
                    type: "image_url",
                    imageUrl: URL.createObjectURL(file)
                } as never // SDK document type mismatch with imageUrl
            });

            const ocrMarkdown = ocrResponse.pages?.map((p: { markdown: string }) => p.markdown).join("\n") || "";

            const vision = await client.chat.complete({
                model: aiFeatures.media.model || "pixtral-12b-2409",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Analyze this image. Summarize documents or describe scenes/subjects. Output ONLY clean Markdown (Headers, Bullets). No code blocks." },
                            { type: "image_url", imageUrl: URL.createObjectURL(file) }
                        ]
                    }
                ]
            });
            const messageContent = vision.choices?.[0].message.content;
            const analysis = typeof messageContent === 'string' ? messageContent : "";
            return {
                description: analysis,
                ocrMarkdown: ocrMarkdown,
                combined: `### Media Analysis\n${analysis}\n\n### OCR Result\n${ocrMarkdown}`
            };
        }
    } catch (e) {
        console.error("Media processing failed", e);
    }

    return null;
};

/**
 * 3. Organization
 */
export const organizeContent = async (text: string, settings: AppSettings, context?: string) => {
    const { aiFeatures } = settings;
    const client = getMistralClient();
    if (!client) return text;

    try {
        const res = await client.chat.complete({
            model: aiFeatures.organization.model || "mistral-small-latest",
            messages: [
                {
                    role: "system",
                    content: `Structure the text using Markdown. Contextual Grouping: Move related blocks together with MINIMAL changes to original text. DO NOT paraphrase. DO NOT rewrite. LaTeX: Use $ for inline, $$ for block. Output ONLY Markdown.${context ? `\n\nContext for organization: ${context}` : ""}`
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
                { role: "system", content: "Summarize in bullets. Wrap in '> [!SUMM]' blockquote. LaTeX: Use $ for inline. Output ONLY blockquote." },
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
    const client = getMistralClient();
    if (!client) return currentNote + "\n\n" + newContext;

    try {
        const chat = await client.chat.complete({
            model: settings.selectedModel || "mistral-large-latest",
            messages: [
                {
                    role: "system",
                    content: `Integrate 'New Information' into 'Existing Note'.
                    1. **STRICT RULE**: Do NOT change a single character of the 'Existing Note'.
                    2. **Insertion**: Insert new info into the most relevant section OR append to end.
                    3. **LaTeX**: Use $ for inline, $$ for block.
                    4. **Ref**: Ensure the media reference (like ![image](${mediaReff}) or [link](${mediaReff})) is included.
                    5. **Output**: ONLY merged Markdown.`
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
                    content: "Fix grammar, spelling, and typos using INLINE EDITS ONLY. Ensure all words are spelled correctly. DO NOT rewrite or paraphrase. STRICTLY preserve Markdown and LaTeX ($ for inline, $$ for block). Output ONLY corrected text."
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
    history: { role: 'user' | 'assistant' | 'tool'; content: string; toolCalls?: unknown[]; toolCallId?: string; name?: string }[],
    currentDoc: string,
    settings: AppSettings,
    onChunk: (text: string) => void
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
                description: "Overwrites the ENTIRE active note with new content.",
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
        {
            type: "function",
            function: {
                name: "replace_text",
                description: "A patch tool to find and replace specific text. Use this for small edits.",
                parameters: {
                    type: "object",
                    properties: {
                        target: {
                            type: "string",
                            description: "The exact text segment to find in the note.",
                        },
                        replacement: {
                            type: "string",
                            description: "The text to replace the target with."
                        }
                    },
                    required: ["target", "replacement"],
                },
            },
        }
    ];

    const systemPrompt = `Expert AI note assistant.
    - Use tools for edits. INLINE EDITS preferred.
    - Minimal changes to existing text.
    - LaTeX math: $ for inline, $$ for block.
    - Concise responses.`;

    const currentMessages = [
        { role: "system", content: systemPrompt },
        ...history
    ];

    try {
        console.log("Starting chat stream...");

        const responseStream = await client.chat.stream({
            model: selectedModel || "mistral-large-latest",
            messages: currentMessages as never,
            tools: tools as never,
            toolChoice: "auto",
        });

        let fullContent = "";
        const toolCallAccumulator: { id: string, function: { name: string, arguments: string }, type: string }[] = [];

        for await (const chunk of responseStream) {
            const choice = chunk.data.choices[0];
            const delta = choice?.delta;

            if (delta?.content) {
                fullContent += delta.content;
                onChunk(fullContent);
            }

            if (delta?.toolCalls) {
                // Accumulate tool calls
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delta.toolCalls.forEach((tc: any) => {
                    const index = tc.index;
                    if (!toolCallAccumulator[index]) {
                        toolCallAccumulator[index] = {
                            id: "",
                            function: { name: "", arguments: "" },
                            type: "function"
                        };
                    }
                    if (tc.id) toolCallAccumulator[index].id += tc.id;
                    if (tc.function?.name) toolCallAccumulator[index].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCallAccumulator[index].function.arguments += tc.function.arguments;
                });
            }
        }

        // Processing completed for this turn
        if (toolCallAccumulator.length > 0) {
            // We have tool calls
            const assistantMessage = {
                role: "assistant", // "assistant"
                content: fullContent || null, // Ensure strict null if empty
                toolCalls: toolCallAccumulator
            };
            currentMessages.push(assistantMessage as never);

            // Execute tools
            for (const toolCall of toolCallAccumulator) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                let toolResult = "";
                console.log(`Executing tool: ${functionName}`);

                if (functionName === "read_active_note") {
                    toolResult = currentDoc;
                } else if (functionName === "write_active_note") {
                    toolResult = "Note updated successfully.";
                } else if (functionName === "replace_text") {
                    const { target, replacement } = functionArgs;
                    if (currentDoc.includes(target)) {
                        const newDoc = currentDoc.replace(target, replacement);
                        toolResult = "Replacement successful.";
                        // Store the new doc state so subsequent tools or recursive calls see it?
                        // Actually we need to push the UPDATE to the UI.
                        // We do this by treating it like write_active_note for the UI hook.
                        // But we need to inject the full content into the magic tag.
                        currentDoc = newDoc; // Update local context reference
                    } else {
                        toolResult = "Error: Target text not found in document.";
                    }
                }

                currentMessages.push({
                    role: "tool",
                    name: functionName,
                    content: toolResult,
                    toolCallId: toolCall.id, // Correct CamelCase property
                } as never); // Cast to avoid any
            }

            // Recursive call for the final answer
            let finalAnswer = "";
            const innerOnChunk = (text: string) => {
                finalAnswer = text;
                onChunk(text); // Propagate stream up
            };

            // @ts-expect-error - Recursive call message types
            await chatWithMistral(currentMessages.slice(1), currentDoc, settings, innerOnChunk);

            // Robust check through the accumulator and message history
            const writeCall = toolCallAccumulator.find(tc => tc.function.name === "write_active_note");
            const replaceCalls = toolCallAccumulator.filter(tc => tc.function.name === "replace_text");

            // Allow if write_active_note was called OR if any replace_text succeeded
            let shouldUpdate = !!writeCall;

            // Check if replacements succeeded by looking at the tool results we pushed
            if (!shouldUpdate && replaceCalls.length > 0) {
                // The tool messages are the last N messages in currentMessages
                const toolMessages = currentMessages.slice(-toolCallAccumulator.length);
                const successfulReplace = toolMessages.some(m => m.role === 'tool' && m.content === "Replacement successful.");
                if (successfulReplace) shouldUpdate = true;
            }

            if (shouldUpdate) {
                // If we did a rewrite, get content from args.
                // If we did a replace, get content from currentDoc (which we patched locally).
                let finalDocContent = currentDoc;

                const writeCall = toolCallAccumulator.find(tc => tc.function.name === "write_active_note");
                if (writeCall) {
                    const args = JSON.parse(writeCall.function.arguments);
                    finalDocContent = args.content;
                }

                // If it was replace_text, currentDoc is already updated above.

                const magicTag = `\n\n<updated_note>${finalDocContent}</updated_note>`;
                console.log("Injecting <updated_note> tag with length:", finalDocContent.length);
                onChunk(finalAnswer + magicTag);
                return finalAnswer + magicTag;
            } else {
                console.log("No write/replace triggered, returning normal response.");
            }

            return finalAnswer;
        }

        return fullContent;

    } catch (e) {
        console.error("Chat failed", e);
        throw e;
    }
};
