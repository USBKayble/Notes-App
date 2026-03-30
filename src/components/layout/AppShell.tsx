"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
// import { Mosaic, MosaicNode, MosaicWindow } from "react-mosaic-component";
// import "react-mosaic-component/react-mosaic-component.css";
import { Settings, Columns, Sparkles, MessageSquare, Mic, SpellCheck, Image as ImageIcon, RefreshCw, AlertCircle, Ungroup, Volume2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { getFileContent } from "@/lib/github";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useSession } from "next-auth/react";

import SettingsModal from "../ui/SettingsModal";
import EditorPane from "../editor/EditorPane";

import MistralChat from "../ai/MistralChat";
import FileExplorer from "../files/FileExplorer";
import AIToggleIcon from "../ui/AIToggleIcon";
import LoginPromptModal from "../ui/LoginPromptModal";
import { processDroppedFile } from "@/lib/AIOrchestrator";
import { summarizeHighlight, transcribeAndCleanup, textToSpeech } from "@/lib/mistral";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSaveManager } from "@/hooks/useSaveManager";

export type ViewId = "editor" | "preview" | "ai-chat" | "media" | "settings" | "files";

export default function AppShell() {
    const { settings } = useSettings();
    const { data: session } = useSession();
    const { isOnline } = useOfflineQueue();
    const { save, saveStatus, saveError, isLocalSave, isAIProcessing } = useSaveManager();

    // Sidebar States
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editorContent, setEditorContent] = useState(`# Welcome to Mistral Notes

## Formatting Guide
- **Bold**: \`**text**\` or \`Ctrl+B\`
- *Italic*: \`*text*\` or \`Ctrl+I\`
- ~Strike~: \`~text~\`
- \`Code\`: \` \`text\` \`

## Math Support
- **Inline**: \`$E=mc^2$\` → $E=mc^2$
- **Block**: \`$$ \\sum $$\`

$$
\\mathcal{L} = -\\frac{1}{4}F_{\\mu\\nu}F^{\\mu\\nu} + i\\bar{\\psi}\\gamma^\\mu D_\\mu \\psi
$$

## Lists & Tasks
1. Ordered list item
2. Another item

- [ ] Todo item
- [x] Completed item

## Keybinds
| Action | Keybind |
|--------|---------|
| **Save** | \`Ctrl+S\` |
| **Undo** | \`Ctrl+Z\` |
| **Redo** | \`Ctrl+Y\` |
`);
    
    // Track content that was last saved to avoid infinite loops and know when to save
    const [lastSavedContent, setLastSavedContent] = useState<string | null>(null); 
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

    // Ref to skip the next auto-save cycle (used after AI updates to prevent loops)
    const skipNextAutoSave = useRef(false);

    // Absolute latest content ref for abort checks and stable handleSave
    const contentRef = useRef(editorContent);
    useEffect(() => { contentRef.current = editorContent; }, [editorContent]);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleReadNote = async () => {
        if (isSpeaking && audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
            return;
        }

        if (!editorContent.trim()) return;

        setIsProcessing(true);
        try {
            const audioUrl = await textToSpeech(editorContent, settings);
            if (audioUrl) {
                const audio = new Audio(audioUrl);
                audioRef.current = audio;

                audio.onended = () => setIsSpeaking(false);
                audio.play();
                setIsSpeaking(true);
            }
        } catch (error) {
            console.error("Failed to read note:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Live Transcription Logic
    const handleTranscriptionChunk = useCallback(async (blob: Blob) => {
        console.log("Processing audio chunk...", { size: blob.size });
        try {
            const text = await transcribeAndCleanup(blob, undefined, settings.aiFeatures.transcription.model);
            console.log("Transcription result:", text);
            if (text) {
                setEditorContent(prev => prev + (prev.endsWith('\n') ? "" : " ") + text);
            }
        } catch (e) {
            console.error("Live transcription failed details:", e);
        }
    }, [settings.aiFeatures.transcription.model]);

    const { startRecording: startLiveTranscribe, stopRecording: stopLiveTranscribe } = useAudioRecorder(handleTranscriptionChunk);

    // Effect to toggle recording based on Transcription State
    useEffect(() => {
        if (settings.aiFeatures.transcription.state === 'apply') {
            startLiveTranscribe();
        } else {
            stopLiveTranscribe();
        }
    }, [settings.aiFeatures.transcription.state, startLiveTranscribe, stopLiveTranscribe]);

    const handleLoadFile = async (path: string) => {
        const token = session?.accessToken as string;
        if (!token || !settings.githubRepo) {
            alert("Please sign in with GitHub and select a repository.");
            return;
        }
        const [owner, repo] = settings.githubRepo.split("/");

        setCurrentFilePath(path);
        try {
            const content = await getFileContent(token, owner, repo, path);
            setEditorContent(content);
            setLastSavedContent(content); // Sync disk state
        } catch (error) {
            console.error("Failed to load file:", error);
            alert(`Failed to load file: ${path}. Check console for details.`);
            setEditorContent("");
            setLastSavedContent("");
        }
    };

    const handleSave = useCallback(async (forcedContent?: string) => {
        if (!currentFilePath) return;

        const contentToProcess = forcedContent || contentRef.current;
        console.log("Executing Save Pipeline for:", currentFilePath);

        try {
            const processedContent = await save(
                contentToProcess, 
                currentFilePath, 
                settings,
                () => contentRef.current !== contentToProcess
            );
            
            // Sync clean tracker immediately to the content that just finished saving
            setLastSavedContent(processedContent);
            
            // If AI processed it into something different AND user hasn't typed anything else,
            // we update the editor to show the "clean" AI version.
            if (processedContent !== contentToProcess) {
                setEditorContent(current => {
                    if (current === contentToProcess) {
                        // Mark that this change was AI-initiated so auto-save doesn't loop
                        skipNextAutoSave.current = true;
                        return processedContent;
                    }
                    console.warn("User resumed typing during AI processing - UI update skipped to prevent overwrite.");
                    return current;
                });
            }

        } catch (e) {
            console.error("Manual save failed", e);
        }
    }, [currentFilePath, settings, save]);

    const [isPendingSave, setIsPendingSave] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        setIsProcessing(true);
        const token = session?.accessToken as string;
        const [owner, repo] = settings.githubRepo ? settings.githubRepo.split("/") : ["", ""];

        try {
            let currentText = editorContent;
            for (const file of files) {
                const result = await processDroppedFile(file, currentText, settings, { token, owner, repo });
                currentText = result.content;
            }
            
            // Mark for skip before setting content
            skipNextAutoSave.current = true;
            setEditorContent(currentText);
            
            // Immediate save after drop chain
            if (currentFilePath) {
                setTimeout(() => handleSave(currentText), 0);
            }
        } catch (error) {
            console.error("Drop processing failed", error);
            alert("Failed to process file. Check console.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePasteFile = async (file: File) => {
        setIsProcessing(true);
        const token = session?.accessToken as string;
        const [owner, repo] = settings.githubRepo ? settings.githubRepo.split("/") : ["", ""];

        try {
            const result = await processDroppedFile(file, editorContent, settings, { token, owner, repo });
            
            // Mark for skip before setting content
            skipNextAutoSave.current = true;
            setEditorContent(result.content);
            
            if (currentFilePath) {
                setTimeout(() => handleSave(result.content), 0);
            }
        } catch (error) {
            console.error("Paste processing failed", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Auto-Save Effect
    useEffect(() => {
        // If this change was flagged as AI-initiated, we skip this save cycle
        if (skipNextAutoSave.current) {
            console.log("Auto-save skipped (AI-initiated change)");
            skipNextAutoSave.current = false;
            setIsPendingSave(false);
            return;
        }

        // Robust comparison: Ignore leading/trailing whitespace and assume it's "same" if it only differs by one newline
        const cleanCurrent = editorContent.trim();
        const cleanLast = (lastSavedContent || "").trim();
        const contentChanged = cleanCurrent !== cleanLast;
        
        // Don't auto-save if no file or no meaningful changes
        if (!currentFilePath || !contentChanged) {
             setIsPendingSave(false);
             return;
        }

        // Set pending state immediately
        setIsPendingSave(true);
        
        const timer = setTimeout(() => {
            handleSave();
            setIsPendingSave(false); // Clear pending after trigger
        }, 3000); // 3 second debounce (Wait for user to stop inputting)

        return () => clearTimeout(timer);
    }, [editorContent, lastSavedContent, currentFilePath, handleSave]);

    return (
        <div
            className="h-screen w-screen overflow-hidden flex relative z-0 bg-background"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <LoginPromptModal />

            {/* Left Sidebar: Files */}
            <div className={`flex flex-col border-r border-white/5 transition-all duration-300 ease-in-out relative ${leftSidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-64">
                        <FileExplorer onSelectFile={handleLoadFile} />
                    </div>
                </div>
            </div>

            {/* Main Content: Editor */}
            <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300 bg-background/50">
                {/* Toolbar / Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 select-none bg-background/80 backdrop-blur-md z-1">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                            className={`hover:text-primary transition-colors ${leftSidebarOpen ? "text-primary" : "text-muted-foreground"}`}
                            title="Toggle Files"
                        >
                            <Columns size={16} className="rotate-180" />
                        </button>

                        <span className="font-medium text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2 group-hover:text-foreground transition-colors">
                            Editor
                            {currentFilePath && (
                                <span className="opacity-50 normal-case font-normal ml-1 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                    {currentFilePath}
                                </span>
                            )}
                            {!isOnline && (
                                <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                    Offline
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Save Status Indicator */}
                        <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4 h-full">
                            {saveStatus === 'saving' ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <RefreshCw size={12} className="animate-spin" />
                                    <span className="text-[10px]">Saving...</span>
                                </div>
                            ) : isPendingSave ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground/70 animate-pulse">
                                    <span className="text-[10px]">Waiting...</span>
                                </div>
                            ) : saveError ? (
                                <div className="flex items-center gap-1.5 text-red-400" title={saveError}>
                                    <AlertCircle size={14} />
                                    <span className="text-[10px]">Failed</span>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleSave()}
                                    className="hover:bg-white/5 rounded px-1.5 py-0.5 transition-colors cursor-pointer text-muted-foreground flex items-center gap-1.5"
                                    title="Click to Save"
                                >
                                    <span className="text-[10px]">
                                        {isLocalSave ? "Saved offline" : "Saved"}
                                    </span>
                                </button>
                            )}

                            {/* AI Processing Status */}
                            {(isProcessing || isAIProcessing) && (
                                <div className="flex items-center gap-1.5 text-purple-400 animate-pulse transition-all duration-300">
                                    <Sparkles size={14} />
                                    <span className="text-[10px]">AI Working...</span>
                                </div>
                            )}
                        </div>


                        {/* AI Features */}
                        <div className="flex items-center gap-1 mr-4 border-r border-white/10 pr-4">
                            <AIToggleIcon feature="transcription" icon={<Mic size={18} />} label="Live Transcription" />
                            <AIToggleIcon feature="tts" icon={<Volume2 size={18} />} label="Text to Speech" />
                            <AIToggleIcon feature="grammar" icon={<SpellCheck size={18} />} label="Grammar" />
                            <AIToggleIcon feature="media" icon={<ImageIcon size={18} />} label="Media & OCR" />
                            <AIToggleIcon feature="organization" icon={<Ungroup size={18} />} label="Auto-Organize" />
                        </div>

                        <button onClick={() => setIsSettingsOpen(true)} className="glass-button w-8 h-8 flex items-center justify-center rounded-md hover:text-primary transition-all">
                            <Settings size={18} />
                        </button>

                        <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-2">
                            <button
                                onClick={async () => {
                                    setIsProcessing(true);
                                    const res = await summarizeHighlight(editorContent, settings);
                                    setEditorContent(prev => typeof res === 'string' ? res : prev);
                                    setIsProcessing(false);
                                }}
                                className="glass-button px-2 py-1 text-[10px] rounded hover:text-purple-400"
                            >
                                Summarize
                            </button>
                            <button
                                onClick={handleReadNote}
                                className={`glass-button px-2 py-1 text-[10px] rounded hover:text-blue-400 ${isSpeaking ? "text-blue-400 animate-pulse bg-blue-500/10" : ""}`}
                            >
                                {isSpeaking ? "Stop Reading" : "Read Note"}
                            </button>
                        </div>

                        <button
                            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                            className={`hover:text-primary transition-colors ml-2 ${rightSidebarOpen ? "text-primary" : "text-muted-foreground"}`}
                        >
                            <MessageSquare size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative overflow-auto">
                    <EditorPane
                        value={editorContent}
                        onChange={(v) => setEditorContent(v || "")}
                        onFilePaste={handlePasteFile}
                        currentFilePath={currentFilePath}
                    />
                </div>
            </div>

            {/* Right Sidebar: AI Chat */}
            <div className={`flex flex-col border-l border-white/5 transition-all duration-300 ease-in-out relative ${rightSidebarOpen ? "w-80" : "w-0 overflow-hidden"}`}>
                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-80">
                        <MistralChat
                            onTranscription={(text) => setEditorContent(prev => prev + " " + text)}
                            onProposeDiff={(text) => {
                                // Direct update since diffs are removed for now, or just append?
                                // User said "remove diffs". Let's just update editor content directly for now or maybe chat should just append.
                                // For safety, I'll just set it.
                                setEditorContent(text);
                            }}
                            editorContent={editorContent}
                            currentFilePath={currentFilePath}
                        />
                    </div>
                </div>
            </div>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}
