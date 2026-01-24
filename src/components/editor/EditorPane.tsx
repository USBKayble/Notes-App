"use client";

import React, { useRef, useState, useEffect } from "react";
// import Editor, { OnMount, DiffEditor, DiffOnMount } from "@monaco-editor/react"; // REMOVING Monaco
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import matter from "gray-matter";
import { uploadAsset } from "@/lib/github";
import dynamic from "next/dynamic";
import type { MDXEditorMethods } from '@mdxeditor/editor';

// Dynamically import the editor to avoid SSR issues
const InitializedMDXEditor = dynamic(
    () => import('./InitializedMDXEditor'),
    {
        ssr: false,
        loading: () => <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
    }
);

interface EditorPaneProps {
    value: string;
    originalValue?: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    currentFilePath?: string | null;
}

export default function EditorPane({ value, originalValue, onChange, language = "markdown", currentFilePath }: EditorPaneProps) {
    const { settings } = useSettings();
    const { data: session } = useSession();
    const editorRef = useRef<MDXEditorMethods>(null);
    const [metadata, setMetadata] = useState<any>({});
    const [body, setBody] = useState("");
    const [isInternalUpdate, setIsInternalUpdate] = useState(false);

    // Parse incoming value into Metadata + Body
    useEffect(() => {
        if (isInternalUpdate) return;
        try {
            const { data, content } = matter(value);
            setMetadata(data);
            // If body didn't change (only metadata), we don't want to force re-render if not needed.
            // But here we setBody which presumably updates the editor.
            setBody(content);
        } catch (e) {
            setBody(value);
        }
    }, [value, isInternalUpdate]);

    const updateContent = (newMetadata: any, newBody: string) => {
        setIsInternalUpdate(true);
        const newContent = matter.stringify(newBody, newMetadata);
        onChange(newContent);
        setTimeout(() => setIsInternalUpdate(false), 0);
    };



    const handleChange = (newBody: string) => {
        setBody(newBody);
        updateContent(metadata, newBody);
    };

    const handleImageUpload = async (image: File): Promise<string> => {
        const token = (session as any)?.accessToken;
        if (!currentFilePath || !token || !settings.githubRepo) {
            throw new Error("GitHub not configured or file not selected");
        }

        try {
            const [owner, repo] = settings.githubRepo.split("/");
            const timestamp = Date.now();
            // Replace spaces with dashes
            const assetPath = `assets/${timestamp}-${image.name.replace(/\s+/g, '-')}`;

            await uploadAsset(token, owner, repo, assetPath, image);
            return `/assets/${timestamp}-${image.name.replace(/\s+/g, '-')}`;
        } catch (e) {
            console.error("Image upload failed", e);
            throw e;
        }
    };

    return (
        <div className="h-full w-full overflow-hidden bg-transparent flex flex-col">


            <InitializedMDXEditor
                editorRef={editorRef}
                value={body}
                onChange={handleChange}
                imageUploadHandler={handleImageUpload}
            />
        </div>
    );
}
