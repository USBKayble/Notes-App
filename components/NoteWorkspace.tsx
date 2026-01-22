"use client";

import React, { useState } from "react";
import { NoteEditor } from "./NoteEditor";
import { ChatInterface } from "./ChatInterface";
import { saveFile } from "@/lib/github"; // Wait, cannot import server-side lib in client!
// We need a server action or API route for saving.

import { saveNoteWithSync } from "@/lib/sync";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

interface NoteWorkspaceProps {
    filePath: string;
    initialContent: string;
}

export function NoteWorkspace({ filePath, initialContent }: NoteWorkspaceProps) {
    // Use Dexie's live query to get the latest local version (replaces state)
    const localNote = useLiveQuery(
        () => db.notes.get(filePath),
        [filePath]
    );

    // If local note exists, use it. Otherwise use initialContent (server provided).
    // But wait, initialContent is static from server.
    // If we have a dirty local version, we should prefer it.
    const content = localNote?.content ?? initialContent;

    const [diffContent, setDiffContent] = useState<string | null>(null);

    const handleSave = async (newContent: string) => {
        // Use Sync Logic
        console.log("Saving...");
        await saveNoteWithSync(filePath, newContent);
    };

    const handleDiffRequest = (suggestedContent: string) => {
        setDiffContent(suggestedContent);
    };

    const handleAcceptDiff = () => {
        if (diffContent) {
            handleSave(diffContent); // Save to DB, which updates 'content' via liveQuery
            setDiffContent(null);
        }
    };

    return (
        <div className="flex h-full w-full">
            <div className="flex-1 h-full min-w-0">
                <NoteEditor
                    initialContent={content}
                    language={filePath.endsWith(".md") ? "markdown" : "plaintext"}
                    diffContent={diffContent}
                    onSave={handleSave}
                    onAcceptDiff={handleAcceptDiff}
                    onRejectDiff={() => setDiffContent(null)}
                    className="border-none rounded-none"
                />
            </div>
            <div className="w-[350px] h-full border-l">
                <ChatInterface
                    currentFile={filePath}
                    currentContent={content}
                    onDiffRequest={handleDiffRequest}
                />
            </div>
        </div>
    );
}
