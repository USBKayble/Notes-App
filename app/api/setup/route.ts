import { NextResponse } from "next/server";
import { setConfig } from "@/lib/session";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { github, mistral } = body;

        // Basic Validation
        if (!github?.token || !github?.owner || !github?.repo) {
            return NextResponse.json({ error: "Missing GitHub credentials" }, { status: 400 });
        }
        if (!mistral?.apiKey) {
            return NextResponse.json({ error: "Missing Mistral credentials" }, { status: 400 });
        }

        await setConfig({ github, mistral });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Setup Save Error:", error);
        return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }
}
