"use client";

import React, { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "next-auth/react";
import { getNote, saveNote } from "@/lib/github";
import { Tag, Loader2, X, Save } from "lucide-react";

interface TagEditorProps {
    path: string;
    onClose: () => void;
}

export default function TagEditor({ path, onClose }: TagEditorProps) {
    const { settings } = useSettings();
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tags, setTags] = useState("");
    const [title, setTitle] = useState("");
    const [noteContent, setNoteContent] = useState("");
    const [metadata, setMetadata] = useState<Record<string, unknown>>({});

    useEffect(() => {
        const load = async () => {
            const token = (session as unknown as { accessToken?: string })?.accessToken;
            if (!token || !settings.githubRepo) return;
            const [owner, repo] = settings.githubRepo.split("/");

            const note = await getNote(token, owner, repo, path);
            if (note) {
                setMetadata(note.metadata as Record<string, unknown>);
                setNoteContent(note.content);
                setTitle(note.metadata.title || "");
                const t = note.metadata.tags;
                setTags(Array.isArray(t) ? t.join(", ") : (t || ""));
            }
            setLoading(false);
        };
        load();
    }, [path, settings.githubRepo, session]);

    const handleSave = async () => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!token || !settings.githubRepo) return;
        setSaving(true);
        const [owner, repo] = settings.githubRepo.split("/");

        const newMetadata = {
            ...metadata,
            title,
            tags: tags.split(",").map(t => t.trim()).filter(Boolean)
        };

        try {
            await saveNote(token, owner, repo, {
                path,
                metadata: newMetadata,
                content: noteContent
            });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save tags");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute top-10 left-full ml-2 w-64 bg-[#111115] border border-white/10 rounded-lg shadow-xl p-4 z-50 animate-in fade-in slide-in-from-left-2">
            <div className="flex items-center justify-between mb-3 text-xs font-medium text-muted-foreground">
                <span>Edit Metadata</span>
                <button onClick={onClose} className="hover:text-foreground"><X size={14} /></button>
            </div>

            {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-bold">Title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="bg-black/20 border border-white/5 rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
                            placeholder="Note Title"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-bold">Tags</label>
                        <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded px-2 py-1.5 focus-within:border-primary/50">
                            <Tag size={12} className="text-muted-foreground" />
                            <input
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                className="bg-transparent text-xs text-foreground focus:outline-none w-full"
                                placeholder="work, ideas..."
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="mt-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded py-1.5 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );
}
