"use client";

import React, { useRef, useCallback, useMemo } from "react";
import { useSettings } from "@/hooks/useSettings";
import { Loader2 } from "lucide-react";
import matter from "gray-matter";
import dynamic from "next/dynamic";

const MilkdownEditor = dynamic(
    () => import('./MilkdownEditor'),
    {
        ssr: false,
        loading: () => <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
    }
);

interface EditorPaneProps {
    value: string;
    onChange: (value: string | undefined) => void;
    onFilePaste?: (file: File) => void;
    currentFilePath?: string | null;
}

export default function EditorPane({ value, onChange, onFilePaste }: EditorPaneProps) {
    const { settings } = useSettings();
    const isInternalUpdate = useRef(false);
    
    const onChangeRef = useRef(onChange);
    React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    // Helper to transform paths for display
    const transformForDisplay = useCallback((text: string) => {
        if (!settings.githubRepo) return text;
        const [owner, repo] = settings.githubRepo.split("/");
        // Match ![alt](media/path) or [link](media/path) or assets/media/path
        // regex: (\!?\[.*?\]\()((?:assets\/)?media\/.*?)(?=\))
        return text.replace(/(!?[\[\]].*?\]\()((?:assets\/)?media\/.*?)(?=\))/g, (match, p1, p2) => {
            return `${p1}/api/proxy-media?owner=${owner}&repo=${repo}&path=${p2}`;
        });
    }, [settings.githubRepo]);

    // Helper to transform paths for storage
    const transformForStorage = useCallback((text: string) => {
        // regex: (\!?\[.*?\]\()(\/api\/proxy-media\?.*?path=)((?:assets\/)?media\/.*?)(?:&.*?)?(\))
        return text.replace(/(!?[\[\]].*?\]\()\/api\/proxy-media\?.*?path=((?:assets\/)?media\/.*?)(?:&.*?)?(\))/g, (match, p1, p2, p3) => {
            return `${p1}${p2}${p3}`;
        });
    }, []);

    const { body, rawFrontmatter } = useMemo(() => {
        try {
            const parsed = matter(value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const frontmatter = (value.startsWith('---') && (parsed as any).matter) ? (parsed as any).matter : null;
            return {
                body: transformForDisplay(parsed.content),
                rawFrontmatter: frontmatter
            };
        } catch {
            return {
                body: transformForDisplay(value),
                rawFrontmatter: null
            };
        }
    }, [value, transformForDisplay]);

    const handleChange = (newBody: string) => {
        if (newBody === body) return;
        
        isInternalUpdate.current = true;
        
        const bodyForStorage = transformForStorage(newBody);
        let newContent;
        if (rawFrontmatter !== null) {
             newContent = `---${rawFrontmatter}
---
${bodyForStorage}`;
        } else {
             newContent = bodyForStorage;
        }

        if (newContent !== value) {
            onChangeRef.current(newContent);
        }
        
        // Use a microtask to reset the flag after the parent has likely finished its update cycle
        Promise.resolve().then(() => {
            isInternalUpdate.current = false;
        });
    };

    return (
        <div className="min-h-full w-full bg-transparent flex flex-col">
            <MilkdownEditor
                value={body}
                onChange={handleChange}
                onFilePaste={onFilePaste}
            />
        </div>
    );
}