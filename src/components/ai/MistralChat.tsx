"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Send, StopCircle, Pencil, Check, X } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { transcribeAndCleanup, chatWithMistral } from "@/lib/mistral";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { motion, AnimatePresence } from "framer-motion";

interface MistralChatProps {
    onTranscription?: (text: string) => void;
    onProposeDiff?: (text: string) => void;
    editorContent: string;
    currentFilePath?: string | null;
}

export default function MistralChat({ onTranscription, onProposeDiff, editorContent, currentFilePath }: MistralChatProps) {
    const { settings } = useSettings();
    const { isOnline, addToQueue } = useOfflineQueue();
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Message state now includes isLoading flag per message for smoother transitions
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; isLoading?: boolean }[]>([
        { role: "assistant", content: "Hello! I'm your Mistral AI assistant. Start typing or recording to transcribe." }
    ]);

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTranscriptionChunk = useCallback(async (blob: Blob) => {
        if (!isOnline) {
            setMessages(prev => [...prev, { role: "assistant", content: `[Offline]: Audio queued for transcription. Will sync to ${currentFilePath || "folder"} when online.` }]);
            await addToQueue('AI_JOB', {
                jobType: 'TRANSCRIBE_AND_CLEANUP',
                audioBlob: blob,
                targetPath: currentFilePath
            });
            return;
        }

        try {
            const text = await transcribeAndCleanup(blob);
            if (text && onTranscription) {
                onTranscription(text);
                setMessages(prev => [...prev, { role: "assistant", content: `[Transcribed]: ${text}` }]);
            }
        } catch (e) {
            console.error("Transcription failed", e);
            setMessages(prev => [...prev, { role: "assistant", content: "[Error]: Transcription failed." }]);
        }
    }, [isOnline, onTranscription, currentFilePath, addToQueue]);

    const { isRecording, startRecording, stopRecording } = useAudioRecorder(handleTranscriptionChunk);

    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isGlobalLoading) return;

        const userMsg = { role: 'user' as const, content: input };
        // Optimistically add user message AND assistant placeholder with loading state
        // This prevents the "double bubble" issue by having the loading state LIVE INSIDE the bubble
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', isLoading: true }]);

        setInput("");
        setIsGlobalLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        try {
            const assistantResponse = await chatWithMistral(
                [...messages, userMsg], 
                editorContent,
                settings,
                (chunk) => {
                    // Update state with chunk
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg.role === 'assistant') {
                            lastMsg.content = chunk;
                            lastMsg.isLoading = false; // Content arrived, remove loading
                        }
                        return newMsgs;
                    });
                }
            );

            // Final sync after stream completion
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === 'assistant') {
                    lastMsg.isLoading = false;

                    // Parse magic tag for tool execution
                    const parts = (assistantResponse as string).split("<updated_note>");
                    // If we have parts, it means tool ran. 
                    // Update content to remove the tag for display purposes.
                    // If content was empty (tool only), add a confirmation message.
                    lastMsg.content = parts[0].trim() || (parts.length > 1 ? "I have updated the note." : lastMsg.content);

                    if (parts.length > 1) {
                        const newNoteContent = parts[1].replace("</updated_note>", "");
                        console.log("Applying Diff:", newNoteContent.substring(0, 50) + "...");
                        onProposeDiff?.(newNoteContent);
                    }
                }
                return newMsgs;
            });
        } catch (e: unknown) {
            console.error("Chat failed details:", e);
            const errorMessage = (e as Error)?.message ? `[Error]: ${(e as Error).message}` : "[Error]: Failed to get response from Mistral.";
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === 'assistant') {
                    lastMsg.content = errorMessage;
                    lastMsg.isLoading = false;
                }
                return newMsgs;
            });
        } finally {
            setIsGlobalLoading(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const saveEdit = (index: number) => {
        setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[index].content = editValue;
            return newMsgs;
        });
        setEditingIndex(null);
    };

    // Helper to strip tags for display (redundant safetey)
    const cleanContent = (content: string) => {
        if (!content) return "";
        return content.replace(/<updated_note>[\s\S]*?<\/updated_note>/g, "").trim();
    };

    // Inline Loading Component
    const BraidingDots = () => {
        const generateKeyframes = (index: number) => {
            const frames = 60;
            const x = [];
            const y = [];
            const scales = [];
            const phase = index * (2 * Math.PI / 3);

            for (let i = 0; i <= frames; i++) {
                const t = (i / frames) * 2 * Math.PI;
                x.push(12 * Math.cos(t + phase)); // Reduced radius for inline
                y.push(6 * Math.sin(2 * (t + phase)));
                scales.push(1 + 0.15 * Math.abs(Math.sin(2 * (t + phase))));
            }
            return { x, y, scales };
        };

        return (
            <div className="flex items-center justify-center h-6 w-16 relative">
                {[0, 1, 2].map((i) => {
                    const { x, y, scales } = generateKeyframes(i);
                    return (
                        <motion.div
                            key={i}
                            animate={{ x, y, scale: scales }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute w-1.5 h-1.5 bg-gray-400 rounded-full"
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                <AnimatePresence initial={false} mode="popLayout">
                    {messages.map((msg, i) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            key={i}
                            className={`flex w-full group ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`relative max-w-[85%] px-5 py-3 text-sm leading-relaxed overflow-hidden ${msg.role === "user"
                                    ? "bg-primary text-white rounded-2xl rounded-tr-sm shadow-[0_4px_20px_-4px_rgba(139,92,246,0.3)]"
                                    : "bg-white/5 text-gray-100 rounded-2xl rounded-tl-sm border border-white/5"
                                    }`}
                            >
                                <AnimatePresence mode="wait">
                                    {editingIndex === i ? (
                                        <motion.div
                                            key="editing"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col gap-2 min-w-[200px]"
                                        >
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-full bg-black/20 text-white rounded p-2 text-sm outline-none border border-white/10 focus:border-white/30 resize-none"
                                                rows={3}
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setEditingIndex(null)} className="p-1 hover:text-red-300 transition-colors"><X size={14} /></button>
                                                <button onClick={() => saveEdit(i)} className="p-1 hover:text-green-300 transition-colors"><Check size={14} /></button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <>
                                            {msg.isLoading && !msg.content ? (
                                                <motion.div
                                                    key="loading"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <BraidingDots />
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="content"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ duration: 0.4 }}
                                                >
                                                    {cleanContent(msg.content)}
                                                </motion.div>
                                            )}
                                            
                                            {/* Edit Button for User */}
                                            {msg.role === 'user' && !editingIndex && (
                                                <div className="absolute top-2 right-full mr-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => { setEditingIndex(i); setEditValue(msg.content); }}
                                                        className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white backdrop-blur-md border border-white/5"
                                                        title="Edit message"
                                                    >
                                                        <Pencil size={10} />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2">
                <div className="glass-panel p-1.5 rounded-xl flex items-end gap-2 relative transition-all duration-300">
                    <button
                        onClick={toggleRecording}
                        className={`p-2.5 rounded-full transition-all duration-300 mb-0.5 ${isRecording
                            ? "bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                            : "hover:bg-white/10 text-muted-foreground hover:text-white"
                            }`}
                        title="Start/Stop Transcription"
                    >
                        {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isRecording ? "Listening..." : "Ask Mistral..."}
                        rows={1}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-muted-foreground/50 resize-none outline-none py-3 max-h-[150px] min-h-[44px]"
                        style={{ height: 'auto' }}
                    />

                    <button
                        onClick={() => {
                            handleSend();
                        }}
                        disabled={!input.trim()}
                        className={`p-2.5 rounded-full transition-all duration-300 mb-0.5 ${input.trim() && !isGlobalLoading
                            ? "bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95"
                            : "text-muted-foreground/50 cursor-not-allowed"}`}
                    >
                        <Send size={16} className={input.trim() && !isGlobalLoading ? "translate-x-0.5" : ""} />
                    </button>
                    {isRecording && (
                        <span className="absolute -top-8 left-0 right-0 mx-auto w-max text-[10px] text-red-400 font-medium bg-black/80 px-2 py-1 rounded-full border border-red-500/20 flex items-center gap-1.5 pointer-events-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Recording...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
