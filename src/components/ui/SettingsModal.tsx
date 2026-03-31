"use client";

import React, { useState } from "react";
import { X, ExternalLink, Key, Plus, Trash2, Mic, Volume2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { listVoices, createVoice, deleteVoice, VoiceInfo } from "@/lib/mistral";
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
    
    const [voices, setVoices] = useState<VoiceInfo[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [isCreatingVoice, setIsCreatingVoice] = useState(false);
    const [voiceName, setVoiceName] = useState("");
    const [selectedAudio, setSelectedAudio] = useState<File | null>(null);

    // Sync internal state when settings load
    React.useEffect(() => {
        setFormState(settings);
    }, [settings]);

    React.useEffect(() => {
        if (isOpen && settings.mistralApiKey) {
            setIsLoadingVoices(true);
            listVoices(settings.mistralApiKey)
                .then(setVoices)
                .finally(() => setIsLoadingVoices(false));
        }
    }, [isOpen, settings.mistralApiKey]);

    const handleCreateVoice = async () => {
        if (!voiceName.trim() || !selectedAudio || !settings.mistralApiKey) return;
        
        setIsCreatingVoice(true);
        const newVoice = await createVoice(settings.mistralApiKey, voiceName, selectedAudio);
        setIsCreatingVoice(false);
        
        if (newVoice) {
            setVoices([...voices, newVoice]);
            setVoiceName("");
            setSelectedAudio(null);
            setFormState({
                ...formState,
                aiFeatures: {
                    ...formState.aiFeatures,
                    tts: { ...formState.aiFeatures.tts, voiceId: newVoice.id }
                }
            });
        }
    };

    const handleDeleteVoice = async (voiceId: string) => {
        if (!settings.mistralApiKey) return;
        
        const success = await deleteVoice(settings.mistralApiKey, voiceId);
        if (success) {
            setVoices(voices.filter(v => v.id !== voiceId));
            if (formState.aiFeatures.tts.voiceId === voiceId) {
                setFormState({
                    ...formState,
                    aiFeatures: {
                        ...formState.aiFeatures,
                        tts: { ...formState.aiFeatures.tts, voiceId: "" }
                    }
                });
            }
        }
    };

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

                    {/* Mistral API Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300 block">
                            Mistral API Key
                        </label>
                        <input
                            type="password"
                            value={formState.mistralApiKey}
                            onChange={(e) =>
                                setFormState({ ...formState, mistralApiKey: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                            placeholder="Enter your Mistral API Key"
                        />
                        <p className="text-xs text-gray-500">
                            Required to use AI features.
                        </p>
                    </div>

                    {/* Github Section */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
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

                    <div className="space-y-3 pt-2 border-t border-white/10">
                        <label className="text-sm font-medium text-gray-300 block flex items-center gap-2">
                            <Volume2 size={14} />
                            Text-to-Speech Voice
                        </label>
                        
                        {settings.mistralApiKey ? (
                            <>
                                <select
                                    value={formState.aiFeatures.tts.voiceId}
                                    onChange={(e) =>
                                        setFormState({
                                            ...formState,
                                            aiFeatures: {
                                                ...formState.aiFeatures,
                                                tts: { ...formState.aiFeatures.tts, voiceId: e.target.value }
                                            }
                                        })
                                    }
                                    className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                                >
                                    <option value="">Select a voice...</option>
                                    {voices.map(voice => (
                                        <option key={voice.id} value={voice.id}>{voice.name}</option>
                                    ))}
                                </select>

                                <div className="bg-black/20 border border-white/5 rounded-lg p-3 space-y-2">
                                    <p className="text-xs text-gray-400">Create new voice (voice cloning)</p>
                                    <input
                                        type="text"
                                        value={voiceName}
                                        onChange={(e) => setVoiceName(e.target.value)}
                                        placeholder="Voice name (e.g., 'My Voice')"
                                        className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                                    />
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={(e) => setSelectedAudio(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                                    />
                                    <button
                                        onClick={handleCreateVoice}
                                        disabled={!voiceName.trim() || !selectedAudio || isCreatingVoice}
                                        className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Plus size={14} />
                                        {isCreatingVoice ? "Creating..." : "Create Voice"}
                                    </button>
                                </div>

                                {voices.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Saved voices:</p>
                                        {voices.map(voice => (
                                            <div key={voice.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2 text-sm">
                                                <span className="text-white">{voice.name}</span>
                                                <button
                                                    onClick={() => handleDeleteVoice(voice.id)}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {isLoadingVoices && <p className="text-xs text-gray-500">Loading voices...</p>}
                            </>
                        ) : (
                            <p className="text-xs text-gray-500">Add your Mistral API key to manage TTS voices.</p>
                        )}
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
