import { NextResponse } from "next/server";
import { saveFile } from "@/lib/github";

export async function POST(req: Request) {
    try {
        const { path, content, message } = await req.json();
        if (!path || content === undefined) {
            return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
        }

        await saveFile(path, content, message || "Update from Mistral Notes");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Save API Error:", error);
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }
}
