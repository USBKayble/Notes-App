"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Send, StopCircle } from "lucide-react";
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

    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
        { role: "assistant", content: "Hello! I'm your Mistral AI assistant. Start typing or recording to transcribe." }
    ]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTranscriptionChunk = useCallback(async (blob: Blob) => {
        // if (!settings.mistralApiKey) return; // Using global key

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
            const text = await transcribeAndCleanup(blob); // implicit global key
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

    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user' as const, content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        try {
            const response = await chatWithMistral(newMessages, editorContent, settings);

            // Auto-parse for <updated_note> tags
            const updateMatch = response.match(/<updated_note>([\s\S]*?)<\/updated_note>/);
            if (updateMatch && updateMatch[1]) {
                const suggestedText = updateMatch[1].trim();
                onProposeDiff?.(suggestedText);
            }

            // Clean up display text (remove the tags and content inside from the chat bubble if desired, 
            // or just the tags. Usually better to keep the conversation clean)
            const displayText = response.replace(/<updated_note>[\s\S]*?<\/updated_note>/, "").trim() || "Applied changes to the document.";

            setMessages(prev => [...prev, { role: "assistant", content: displayText }]);
        } catch (e: any) {
            console.error("Chat failed details:", {
                error: e,
                message: e.message,
                status: e.status,
                settings: {
                    model: settings.selectedModel
                }
            });
            const errorMessage = e?.message ? `[Error]: ${e.message}` : "[Error]: Failed to get response from Mistral.";
            setMessages(prev => [...prev, { role: "assistant", content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const BraidingDots = () => {
        const generateKeyframes = (index: number) => {
            const frames = 60;
            const x = [];
            const y = [];
            const scales = [];
            // Phase shift for distinct start positions: 0, 120, 240 degrees (in radians)
            const phase = index * (2 * Math.PI / 3);

            for (let i = 0; i <= frames; i++) {
                // Time variable t from 0 to 2PI for one full loop
                const t = (i / frames) * 2 * Math.PI;

                // x = A * cos(t + phase) -> Oscillates Left/Right
                x.push(20 * Math.cos(t + phase));

                // y = B * sin(2 * (t + phase)) -> Oscillates Up/Down twice per X oscillation (Figure 8)
                y.push(8 * Math.sin(2 * (t + phase)));

                // Scale pulse at peaks of Y motion
                scales.push(1 + 0.15 * Math.abs(Math.sin(2 * (t + phase))));
            }
            return { x, y, scales };
        };

        return (
            <div className="flex items-center justify-center p-4 relative h-12 w-full">
                {[0, 1, 2].map((i) => {
                    const { x, y, scales } = generateKeyframes(i);
                    return (
                        <motion.div
                            key={i}
                            animate={{
                                x: x,
                                y: y,
                                scale: scales,
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                            className="absolute w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8" ref={scrollRef}>
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={i}
                            className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`relative max-w-[85%] px-5 py-3 text-sm leading-relaxed ${msg.role === "user"
                                    ? "bg-primary text-white rounded-2xl rounded-tr-sm shadow-[0_4px_20px_-4px_rgba(139,92,246,0.3)]"
                                    : "bg-white/5 text-gray-100 rounded-2xl rounded-tl-sm border border-white/5"
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </motion.div>
                    ))}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-start w-full"
                        >
                            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-6 py-2 border border-white/5">
                                <BraidingDots />
                            </div>
                        </motion.div>
                    )}
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
                            // Dynamic resize
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
                        className={`p-2.5 rounded-full transition-all duration-300 mb-0.5 ${input.trim() && !isLoading
                            ? "bg-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:scale-105 active:scale-95"
                            : "text-muted-foreground/50 cursor-not-allowed"}`}
                    >
                        <Send size={16} className={input.trim() && !isLoading ? "translate-x-0.5" : ""} />
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
