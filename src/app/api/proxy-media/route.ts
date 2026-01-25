import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Octokit } from "octokit";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const path = searchParams.get("path");

    if (!owner || !repo || !path) {
        return new NextResponse("Missing parameters", { status: 400 });
    }

    const octokit = new Octokit({ auth: session.accessToken });

    try {
        const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        if (Array.isArray(fileData) || !('sha' in fileData)) {
            return new NextResponse("Not a file", { status: 400 });
        }

        const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: fileData.sha,
        });

        const buffer = Buffer.from(blobData.content, 'base64');
        
        // Try to guess mime type from extension
        const ext = path.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "png") contentType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "mp3") contentType = "audio/mpeg";
        else if (ext === "wav") contentType = "audio/wav";
        else if (ext === "webm") contentType = "audio/webm";
        else if (ext === "mp4") contentType = "video/mp4";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (e) {
        console.error("Proxy media failed", e);
        return new NextResponse("Failed to fetch media", { status: 500 });
    }
}
