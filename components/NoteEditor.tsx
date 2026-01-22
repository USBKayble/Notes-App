"use client";

import React, { useState, useEffect } from "react";
import { Editor, DiffEditor, useMonaco } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface NoteEditorProps {
    initialContent: string;
    language?: string;
    theme?: "vs-dark" | "light";
    onSave?: (content: string) => void;
    diffContent?: string | null; // If present, show DiffEditor
    onAcceptDiff?: () => void;
    onRejectDiff?: () => void;
    className?: string;
}

export function NoteEditor({
    initialContent,
    language = "markdown",
    theme = "vs-dark",
    onSave,
    diffContent,
    onAcceptDiff,
    onRejectDiff,
    className,
}: NoteEditorProps) {
    const [content, setContent] = useState(initialContent);
    const monaco = useMonaco();

    useEffect(() => {
        if (monaco) {
            // Configure premium settings
            monaco.editor.defineTheme("mistral-dark", {
                base: "vs-dark",
                inherit: true,
                rules: [],
                colors: {
                    "editor.background": "#0a0a0a", // Match bg-black/zinc-950
                    "editor.lineHighlightBackground": "#ffffff0a",
                },
            });
            monaco.editor.setTheme("mistral-dark");
        }
    }, [monaco]);

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            setContent(value);
        }
    };

    // Debounced save or manual save command could go here.
    // For now, we rely on parent to handle saves or expose current content?
    // Actually, usually we pass onChange. But onSave was requested in my thought process.
    // I'll add a proper onChange prop if needed, or stick to internal state + onSave ref.

    // Let's assume user hits Ctrl+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                onSave?.(content);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [content, onSave]);

    if (diffContent) {
        return (
            <div className={cn("relative h-full w-full overflow-hidden rounded-md border", className)}>
                <div className="absolute top-0 z-10 flex w-full justify-between bg-muted/50 p-2 text-xs backdrop-blur-sm">
                    <span className="font-semibold text-muted-foreground">Reviewing AI Changes</span>
                    <div className="space-x-2">
                        <button onClick={onRejectDiff} className="text-red-400 hover:underline">Reject</button>
                        <button onClick={onAcceptDiff} className="text-green-400 hover:underline">Accept</button>
                    </div>
                </div>
                <DiffEditor
                    height="100%"
                    language={language}
                    theme="mistral-dark"
                    original={content}
                    modified={diffContent}
                    options={{
                        readOnly: true, // Usually diff view is read-only for the user to approve?
                        minimap: { enabled: false },
                        padding: { top: 40 },
                    }}
                />
            </div>
        );
    }

    return (
        <div className={cn("relative h-full w-full overflow-hidden rounded-md border", className)}>
            <Editor
                height="100%"
                language={language}
                theme="mistral-dark"
                value={content}
                onChange={handleEditorChange}
                loading={<div className="flex items-center justify-center p-4 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Editor...</div>}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontFamily: "var(--font-geist-mono)",
                }}
            />
        </div>
    );
}
