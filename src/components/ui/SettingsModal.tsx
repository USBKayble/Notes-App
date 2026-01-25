"use client";

import React, { useState } from "react";
import { X, ExternalLink, Key } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
// import { fetchMistralModels } from "@/lib/mistral";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { settings, updateSettings } = useSettings();
    const { data: session } = useSession();
    const [formState, setFormState] = useState(settings);

    // Sync internal state when settings load
    React.useEffect(() => {
        setFormState(settings);
    }, [settings]);

    if (!isOpen) return null;

    const handleSave = () => {
        updateSettings(formState);
        onClose();
    };

    const GOOGLE_FONTS = [
        "Inter",
        "Roboto",
        "Open Sans",
        "Lato",
        "Montserrat",
        "Poppins",
        "Oswald",
        "Source Sans Pro",
        "Slabo 27px",
        "Raleway",
        "Pixelify Sans",
        "Fira Code",
        "JetBrains Mono",
        "Inconsolata"
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative border border-white/10 shadow-2xl bg-[#111115]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Key className="text-purple-400" size={20} />
                    Settings
                </h2>

                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar -mr-2 space-y-6">

                    {/* Github Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300 block">
                            GitHub Account
                        </label>

                        {!session ? (
                            <button
                                onClick={() => signIn('github')}
                                className="w-full bg-white text-black font-semibold rounded-md px-3 py-2 text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <ExternalLink size={14} />
                                Sign in with GitHub
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                                {session.user?.image && (
                                    <Image 
                                        src={session.user.image} 
                                        alt="User" 
                                        width={32} 
                                        height={32} 
                                        className="rounded-full" 
                                        unoptimized
                                    />
                                )}
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-white truncate">{session.user?.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{session.user?.email}</p>
                                </div>
                                <button
                                    onClick={() => signOut()}
                                    className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                >
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>


                    {/* Font Section */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                        <label className="text-sm font-medium text-gray-300 block">
                            Editor Font (Google Fonts)
                        </label>
                        <div className="relative">
                            <input
                                list="google-fonts-list"
                                type="text"
                                value={formState.editorFont}
                                onChange={(e) =>
                                    setFormState({ ...formState, editorFont: e.target.value })
                                }
                                className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                                placeholder="Type a font name..."
                            />
                            <datalist id="google-fonts-list">
                                {GOOGLE_FONTS.map(font => (
                                    <option key={font} value={font} />
                                ))}
                            </datalist>
                        </div>
                        <p className="text-xs text-gray-500">
                            Type any font name from Google Fonts.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 transition-all transform hover:scale-105 active:scale-95"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
