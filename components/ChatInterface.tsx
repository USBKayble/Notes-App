"use client";

import React, { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
    currentFile: string;
    currentContent: string;
    onDiffRequest: (newContent: string) => void;
    className?: string;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function ChatInterface({ currentFile, currentContent, onDiffRequest, className }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    context: { currentFile, content: currentContent }
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const assistantMessage: Message = { role: "assistant", content: data.content };
            setMessages(prev => [...prev, assistantMessage]);

            // Check for code blocks to suggest diff
            const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/;
            const match = data.content.match(codeBlockRegex);
            if (match && match[1]) {
                onDiffRequest(match[1]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: "assistant", content: "Error communicating with AI." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col h-full border-l bg-muted/10", className)}>
            <div className="p-3 border-b flex items-center bg-muted/20">
                <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                <span className="text-sm font-medium">Mistral Assistant</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={cn("flex flex-col text-sm max-w-[90%]", m.role === "user" ? "ml-auto items-end" : "items-start")}>
                        <div className={cn("p-2 rounded-lg", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="text-xs text-muted-foreground animate-pulse">Thinking...</div>}
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t flex items-center gap-2">
                <input
                    className="flex-1 bg-transparent border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Ask Mistral to edit..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <button type="submit" disabled={isLoading} className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
