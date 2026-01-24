"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Send, StopCircle, User, Bot } from "lucide-react";
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

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleTranscriptionChunk = useCallback(async (blob: Blob) => {
        if (!settings.mistralApiKey) return;

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
            const text = await transcribeAndCleanup(blob, settings.mistralApiKey);
            if (text && onTranscription) {
                onTranscription(text);
                setMessages(prev => [...prev, { role: "assistant", content: `[Transcribed]: ${text}` }]);
            }
        } catch (e) {
            console.error("Transcription failed", e);
            setMessages(prev => [...prev, { role: "assistant", content: "[Error]: Transcription failed." }]);
        }
    }, [settings.mistralApiKey, isOnline, onTranscription, currentFilePath, addToQueue]);

    const { isRecording, startRecording, stopRecording } = useAudioRecorder(handleTranscriptionChunk);

    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user' as const, content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

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
                    hasKey: !!settings.mistralApiKey,
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

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={i}
                            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'}`}>
                                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>

                            <div
                                className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg backdrop-blur-md border ${msg.role === "user"
                                    ? "bg-primary/10 border-primary/20 text-white rounded-tr-none"
                                    : "bg-white/5 border-white/10 text-gray-200 rounded-tl-none"
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2">
                <div className="glass-panel p-1.5 rounded-full flex items-center gap-2 relative transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                    <button
                        onClick={toggleRecording}
                        className={`p-2.5 rounded-full transition-all duration-300 ${isRecording
                            ? "bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                            : "hover:bg-white/10 text-muted-foreground hover:text-white"
                            }`}
                        title="Start/Stop Transcription"
                    >
                        {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder={isRecording ? "Listening..." : "Ask Mistral..."}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-muted-foreground/50 h-9"
                    />

                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className={`p-2.5 rounded-full transition-all duration-300 ${input.trim() && !isLoading
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
