import React from "react";
import { getFile } from "@/lib/github";
import { NoteWorkspace } from "@/components/NoteWorkspace";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        path: string[];
    }>;
}

export default async function NotePage({ params }: PageProps) {
    const { path } = await params;
    const filePath = path.join("/");

    // Fetch file content from GitHub
    const fileData = await getFile(filePath);

    if (!fileData || Array.isArray(fileData)) {
        if (Array.isArray(fileData)) {
            return <div>Directory listing not supported here yet.</div>;
        }
        return notFound();
    }

    const content = Buffer.from(fileData.content, "base64").toString("utf-8");

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden">
            <header className="flex h-12 flex-shrink-0 items-center border-b bg-muted/40 px-4 text-xs font-medium">
                <span className="opacity-50 mr-2">Editing</span>
                <span>{filePath}</span>
            </header>
            <main className="flex-1 overflow-hidden">
                <NoteWorkspace
                    filePath={filePath}
                    initialContent={content}
                />
            </main>
        </div>
    );
}
