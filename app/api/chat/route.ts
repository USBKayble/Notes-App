import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/mistral";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, context } = body;
        // context: { currentFile: string, content: string }

        const wrapperMessages = [
            {
                role: "system",
                content: `You are an expert AI coding assistant integrated into a Notes App.
You have access to the user's current note content.
If the user asks to edit the note, provide the COMPLETE new content in a code block designated with the language (e.g. markdown).
Current File: ${context?.currentFile || "Unknown"}
Current Content:
\`\`\`
${context?.content || ""}
\`\`\`
`,
            },
            ...messages
        ];

        const response = await chatCompletion("mistral-large-latest", wrapperMessages);

        return NextResponse.json({ content: response });
    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
    }
}
