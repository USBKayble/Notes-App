"use client";

import React, { useState } from "react";
import { Mosaic, MosaicNode, MosaicWindow } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import { Settings, Save, Columns, Monitor, MessageSquare, Mic, SpellCheck, Ungroup, FileText, Image as ImageIcon, Check, X, Eye, EyeOff } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { getFileContent, saveFileContent } from "@/lib/github";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

import SettingsModal from "../ui/SettingsModal";
import EditorPane from "../editor/EditorPane";
import MarkdownPreview from "../editor/MarkdownPreview";
import MistralChat from "../ai/MistralChat";
import FileExplorer from "../files/FileExplorer";
import AIToggleIcon from "../ui/AIToggleIcon";
import { processDroppedFile, autoProcessContent } from "@/lib/AIOrchestrator";
import { organizeContent, summarizeHighlight, transcribeAndCleanup } from "@/lib/mistral";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useEffect, useRef, useCallback } from "react";

export type ViewId = "editor" | "preview" | "ai-chat" | "media" | "settings" | "files";

const INITIAL_LAYOUT: MosaicNode<ViewId> | null = "editor";

const TITLE_MAP: Record<ViewId, string> = {
    editor: "Editor",
    preview: "Preview",
    "ai-chat": "Mistral AI",
    media: "Media Gallery",
    settings: "Settings",
    files: "Files",
};

export default function AppShell() {
    const { settings } = useSettings();
    const { isOnline, queueLength, addToQueue } = useOfflineQueue();
    // Simplified Mosaic Layout: Just Editor (and potentially Preview later)
    const [layout, setLayout] = useState<MosaicNode<ViewId> | null>("editor");

    // Sidebar States
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editorContent, setEditorContent] = useState("# Welcome to Mistral Notes\nStart typing...");
    const [originalContent, setOriginalContent] = useState<string | null>(null);
    const [proposedContent, setProposedContent] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(true);

    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Auto-AI Processing Loop
    const isAutoProcessing = useRef(false);
    const lastProcessedContent = useRef<string>("");

    // Live Transcription Logic
    const handleTranscriptionChunk = useCallback(async (blob: Blob) => {
        if (!settings.mistralApiKey) {
            console.warn("Transcription skipped: No API Key");
            return;
        }
        console.log("Processing audio chunk...", { size: blob.size });
        try {
            // Note: We use the transcription settings model here
            // transcribeAndCleanup uses the passed model (e.g. voxtral-mini-2507) used for audio
            const text = await transcribeAndCleanup(blob, settings.mistralApiKey, settings.aiFeatures.transcription.model);
            console.log("Transcription result:", text);
            if (text) {
                setEditorContent(prev => prev + (prev.endsWith('\n') ? "" : " ") + text);
            }
        } catch (e) {
            console.error("Live transcription failed details:", e);
        }
    }, [settings.mistralApiKey]);

    const { startRecording: startLiveTranscribe, stopRecording: stopLiveTranscribe } = useAudioRecorder(handleTranscriptionChunk);

    // Effect to toggle recording based on Transcription State
    useEffect(() => {
        if (settings.aiFeatures.transcription.state === 'apply') {
            startLiveTranscribe();
        } else {
            stopLiveTranscribe();
        }
    }, [settings.aiFeatures.transcription.state, startLiveTranscribe, stopLiveTranscribe]);

    useEffect(() => {
        // Only run if at least one feature is set to "apply"
        // (Currently mostly Grammar, as Org/Summ are manual now)
        const hasApply = Object.values(settings.aiFeatures).some(f => f.state === 'apply');

        // Reset lastProcessed if settings change to force a re-run if enabled
        // This ensures toggling "Off" -> "Apply" runs immediately
        if (hasApply) {
            // If we just enabled it, we want it to run. 
            // We can achieve this by ensuring lastProcessed != editorContent (if we haven't processed THIS content with THIS setting yet)
            // But strict equality check blocks it if content matches.
            // We'll trust the debounce to handle it.
            lastProcessedContent.current = ""; // FORCE RESET
        }

        if (!hasApply) return;

        // Don't trigger if we just updated the content ourselves
        if (isAutoProcessing.current) return;

        // Don't trigger if content hasn't actually changed in a way that needs processing
        if (editorContent === lastProcessedContent.current) return;

        const timer = setTimeout(async () => {
            isAutoProcessing.current = true;
            console.log("Auto-Processing Triggered...", { contentLen: editorContent.length });
            try {
                const refined = await autoProcessContent(editorContent, settings);
                // Mark this content as processed regardless of whether it changed
                lastProcessedContent.current = refined;

                if (refined !== editorContent) {
                    console.log("Auto-Processing Applied Changes");
                    setEditorContent(refined);
                } else {
                    console.log("Auto-Processing: No changes needed");
                }
            } catch (error) {
                console.error("Auto-processing error:", error);
            } finally {
                isAutoProcessing.current = false;
            }
        }, 3000); // 3-second debounce

        return () => clearTimeout(timer);
    }, [editorContent, settings.aiFeatures]);

    const handleLoadFile = async (path: string) => {
        if (!settings.githubApiKey || !settings.githubRepo) {
            alert("GitHub API Key or Repository not set in settings.");
            return;
        }
        const [owner, repo] = settings.githubRepo.split("/");

        setCurrentFilePath(path);
        try {
            const content = await getFileContent(settings.githubApiKey, owner, repo, path);
            setEditorContent(content);
            setOriginalContent(content);
            lastProcessedContent.current = content; // Reset tracker
        } catch (error) {
            console.error("Failed to load file:", error);
            alert(`Failed to load file: ${path}. Check console for details.`);
            setEditorContent("");
            setOriginalContent("");
            lastProcessedContent.current = "";
        }
    };

    const handleSave = async () => {
        if (!currentFilePath || !settings.githubApiKey || !settings.githubRepo) {
            alert("No file selected or GitHub settings missing. Please select a file or configure GitHub.");
            return;
        }
        setIsSaving(true);
        const [owner, repo] = settings.githubRepo.split("/");

        try {
            if (isOnline) {
                await saveFileContent(settings.githubApiKey, owner, repo, currentFilePath, editorContent);
                setOriginalContent(editorContent);
            } else {
                throw new Error("Offline");
            }
        } catch (e) {
            console.log("Saving failed or offline, queuing...", e);
            await addToQueue('FILE_SAVE', {
                owner, repo, path: currentFilePath, content: editorContent
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAcceptDiff = () => {
        if (!proposedContent) return;
        setOriginalContent(proposedContent);
        setEditorContent(proposedContent);
        setProposedContent(null);
    };

    const handleDiscardDiff = () => {
        if (originalContent !== null) {
            setEditorContent(originalContent);
        }
        setProposedContent(null);
    };

    const [isProcessing, setIsProcessing] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            for (const file of files) {
                const result = await processDroppedFile(file, editorContent, settings);
                setEditorContent(result.content);
                if (!result.isSynthesis) {
                    setOriginalContent(result.content);
                }
            }
        } catch (error) {
            console.error("Drop processing failed", error);
            alert("Failed to process file. Check console.");
        } finally {
            setIsProcessing(false);
        }
    };

    const togglePreview = () => {
        // Simple toggle implementation suitable for the 2-pane simplified layout
        if (typeof layout === 'string' && layout === 'editor') {
            setLayout({ direction: 'row', first: 'editor', second: 'preview', splitPercentage: 50 });
        } else {
            // If complex or already open, reset to editor (close preview)
            // This simplificication assumes we only toggle between Editor and Editor+Preview.
            setLayout('editor');
        }
    };

    return (
        <div
            className="h-screen w-screen overflow-hidden flex relative z-0 bg-background"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            {isProcessing && (
                <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="glass-panel p-8 rounded-3xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
                        <Monitor className="text-primary animate-pulse" size={48} />
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white">AI Processing...</h3>
                            <p className="text-sm text-muted-foreground">Orchestrating multi-model stack</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Left Sidebar: Files */}
            <div className={`flex flex-col border-r border-white/5 transition-all duration-300 ease-in-out relative ${leftSidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-64"> {/* Fixed width container to prevent content squish during transition */}
                        <FileExplorer onSelectFile={handleLoadFile} />
                    </div>
                </div>
            </div>

            {/* Main Content: Mosaic (Editor) */}
            <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-300">
                {/* Top Navigation / Toolbar (Optional, merged with Mosaic toolbar usually, but we can add global toggles here) */}

                <Mosaic<ViewId>
                    renderTile={(id, path) => (
                        <MosaicWindow<ViewId>
                            path={path}
                            createNode={() => "editor"}
                            title=""
                            toolbarControls={[]}
                            renderToolbar={() => (
                                <div className="flex items-center justify-between px-4 h-full w-full select-none cursor-move group">
                                    <div className="flex items-center gap-3">
                                        {/* Sidebar Toggles (Visible inside toolbar when regular buttons are hidden) */}
                                        <button
                                            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                                            className={`hover:text-primary transition-colors ${leftSidebarOpen ? "text-primary" : "text-muted-foreground"}`}
                                            title="Toggle Files"
                                        >
                                            <Columns size={14} className="rotate-180" />
                                        </button>

                                        <span className="font-medium text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2 group-hover:text-foreground transition-colors">
                                            {TITLE_MAP[id]}
                                            {id === 'editor' && currentFilePath && (
                                                <span className="opacity-50 normal-case font-normal ml-1 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                                    {currentFilePath}
                                                </span>
                                            )}
                                            {!isOnline && (
                                                <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                                    Offline
                                                </span>
                                            )}
                                            {queueLength > 0 && (
                                                <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                                    Sync: {queueLength}
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {/* AI Features (New!) */}
                                        {id === 'editor' && (
                                            <div className="flex items-center gap-1 mr-4 border-r border-white/10 pr-4">
                                                <AIToggleIcon
                                                    feature="transcription"
                                                    icon={<Mic size={12} />}
                                                    label="Live Transcription"
                                                    allowedStates={["off", "apply"]}
                                                />
                                                <AIToggleIcon feature="grammar" icon={<SpellCheck size={12} />} label="Grammar" />
                                                <AIToggleIcon feature="media" icon={<ImageIcon size={12} />} label="Media & OCR" />
                                            </div>
                                        )}

                                        {id === 'editor' && proposedContent && (
                                            <div className="flex items-center gap-1 mr-2 px-2 border-r border-white/10">
                                                <button
                                                    onClick={handleAcceptDiff}
                                                    className="p-1.5 rounded-md text-green-400 hover:bg-green-400/10 transition-colors"
                                                    title="Accept AI Changes"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={handleDiscardDiff}
                                                    className="p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-colors"
                                                    title="Discard AI Changes"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <button onClick={() => setIsSettingsOpen(true)} className="glass-button p-1.5 rounded-md hover:text-primary">
                                            <Settings size={12} />
                                        </button>

                                        {/* Manual AI Triggers */}
                                        <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-2">
                                            <button
                                                onClick={async () => {
                                                    setIsProcessing(true);
                                                    const res = await organizeContent(editorContent, settings);
                                                    setEditorContent(prev => typeof res === 'string' ? res : prev);
                                                    setIsProcessing(false);
                                                }}
                                                className="glass-button px-2 py-1 text-[10px] rounded hover:text-purple-400"
                                                title="Run AI Organization"
                                            >
                                                Organize
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setIsProcessing(true);
                                                    const res = await summarizeHighlight(editorContent, settings);
                                                    setEditorContent(prev => typeof res === 'string' ? res : prev);
                                                    setIsProcessing(false);
                                                }}
                                                className="glass-button px-2 py-1 text-[10px] rounded hover:text-purple-400"
                                                title="Run AI Summarization"
                                            >
                                                Summarize
                                            </button>
                                        </div>

                                        {id === 'editor' && (
                                            <>
                                                <button
                                                    onClick={() => setShowDiff(!showDiff)}
                                                    className={`glass-button p-1.5 rounded-md ${showDiff ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                                                    title="Toggle Diff View"
                                                >
                                                    <span className="text-[10px] font-bold">DIFF</span>
                                                </button>
                                                <button
                                                    onClick={togglePreview}
                                                    className={`glass-button p-1.5 rounded-md hover:text-primary ${typeof layout !== 'string' ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                                                    title="Toggle Preview"
                                                >
                                                    {typeof layout !== 'string' ? <Eye size={14} /> : <EyeOff size={14} />}
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    className={`glass-button p-1.5 rounded-md ${isSaving ? "text-yellow-400 animate-pulse" : "hover:text-green-400"}`}
                                                    title="Save to GitHub"
                                                >
                                                    <Save size={12} />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                                            className={`hover:text-primary transition-colors ml-2 ${rightSidebarOpen ? "text-primary" : "text-muted-foreground"}`}
                                            title="Toggle Chat"
                                        >
                                            <MessageSquare size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        >
                            <div className="h-full w-full relative overflow-hidden bg-transparent">
                                {id === 'editor' ? (
                                    <EditorPane
                                        value={editorContent}
                                        originalValue={showDiff && originalContent ? (originalContent ?? undefined) : undefined}
                                        onChange={(v) => setEditorContent(v || "")}
                                    />
                                ) : id === 'preview' ? (
                                    <MarkdownPreview content={editorContent} />
                                ) : (
                                    <div className="p-4 flex items-center justify-center h-full text-muted-foreground">
                                        {TITLE_MAP[id]}
                                    </div>
                                )}
                            </div>
                        </MosaicWindow>
                    )}
                    value={layout}
                    onChange={setLayout}
                    className="mosaic-blueprint-theme"
                />
            </div>

            {/* Right Sidebar: AI Chat */}
            <div className={`flex flex-col border-l border-white/5 transition-all duration-300 ease-in-out relative ${rightSidebarOpen ? "w-80" : "w-0 overflow-hidden"}`}>
                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-80">
                        <MistralChat
                            onTranscription={(text) => setEditorContent(prev => prev + " " + text)}
                            onProposeDiff={(text) => {
                                setOriginalContent(editorContent);
                                setEditorContent(text);
                                setProposedContent(text);
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
