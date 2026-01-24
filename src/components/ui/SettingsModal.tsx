"use client";

import React, { useState } from "react";
import { X, ExternalLink, Key } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { fetchMistralModels } from "@/lib/mistral";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { settings, updateSettings } = useSettings();
    const [formState, setFormState] = useState(settings);
    const [models, setModels] = useState<{ id: string }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Sync internal state when settings load
    React.useEffect(() => {
        setFormState(settings);
    }, [settings]);

    // Fetch models only when modal opens or key changes
    React.useEffect(() => {
        if (isOpen && settings.mistralApiKey) {
            setLoadingModels(true);
            fetchMistralModels(settings.mistralApiKey)
                .then(mods => {
                    setModels(mods);
                })
                .finally(() => setLoadingModels(false));
        }
    }, [isOpen, settings.mistralApiKey]);

    if (!isOpen) return null;

    const handleSave = () => {
        updateSettings(formState);
        onClose();
    };

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
                    Settings & Keys
                </h2>

                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar -mr-2 space-y-4">
                    {/* Mistral Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex justify-between">
                            Mistral API Key
                            <a
                                href="https://console.mistral.ai/api-keys/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 text-xs flex items-center gap-1 hover:underline"
                            >
                                Get Key <ExternalLink size={10} />
                            </a>
                        </label>
                        <input
                            type="password"
                            value={formState.mistralApiKey}
                            onChange={(e) =>
                                setFormState({ ...formState, mistralApiKey: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                            placeholder="sk-..."
                        />
                    </div>

                    {/* Model Selection Group */}
                    <div className="space-y-4 border-t border-white/10 pt-4">
                        <label className="text-sm font-bold text-gray-200 flex justify-between items-center">
                            AI Stack Configuration
                            <button
                                onClick={async () => {
                                    setLoadingModels(true);
                                    const mods = await fetchMistralModels(formState.mistralApiKey);
                                    setModels(mods);
                                    setLoadingModels(false);
                                }}
                                className="text-xs text-purple-400 hover:text-white transition-colors"
                                disabled={!formState.mistralApiKey || loadingModels}
                            >
                                {loadingModels ? "Loading..." : "Refresh Models"}
                            </button>
                        </label>

                        {/* General Chat */}
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">General Chat Fallback</label>
                            <select
                                value={formState.selectedModel}
                                onChange={(e) => setFormState({ ...formState, selectedModel: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-[11px] text-white focus:outline-none focus:border-purple-500 transition-colors"
                            >
                                <option value="mistral-large-latest">mistral-large-latest (Recommended)</option>
                                {models.map((m) => (
                                    <option key={m.id} value={m.id}>{m.id}</option>
                                ))}
                            </select>
                        </div>

                        {/* Feature Configs */}
                        {(Object.keys(formState.aiFeatures) as (keyof typeof formState.aiFeatures)[]).map((featureKey) => (
                            <div key={featureKey} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
                                <div className="flex justify-between items-center capitalize">
                                    <span className="text-xs font-medium text-gray-300">{featureKey}</span>
                                    <div className="flex gap-1 bg-black/20 p-1 rounded-md">
                                        {(['off', 'suggest', 'apply'] as const).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => {
                                                    const feat = formState.aiFeatures[featureKey];
                                                    setFormState({
                                                        ...formState,
                                                        aiFeatures: {
                                                            ...formState.aiFeatures,
                                                            [featureKey]: { ...feat, state: s }
                                                        }
                                                    });
                                                }}
                                                className={`px-2 py-0.5 text-[10px] rounded transition-all ${formState.aiFeatures[featureKey].state === s
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <select
                                        value={formState.aiFeatures[featureKey].model}
                                        onChange={(e) => {
                                            const feat = formState.aiFeatures[featureKey];
                                            setFormState({
                                                ...formState,
                                                aiFeatures: {
                                                    ...formState.aiFeatures,
                                                    [featureKey]: { ...feat, model: e.target.value }
                                                }
                                            });
                                        }}
                                        className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="">Select Model...</option>
                                        {models.map((m) => (
                                            <option key={m.id} value={m.id}>{m.id}</option>
                                        ))}
                                    </select>

                                    {featureKey === 'transcription' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[9px] text-gray-500 uppercase tracking-tighter">Cleanup</label>
                                                <select
                                                    value={formState.aiFeatures.transcription.cleanupModel}
                                                    onChange={(e) => {
                                                        const t = formState.aiFeatures.transcription;
                                                        setFormState({
                                                            ...formState,
                                                            aiFeatures: { ...formState.aiFeatures, transcription: { ...t, cleanupModel: e.target.value } }
                                                        });
                                                    }}
                                                    className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[10px] text-white"
                                                >
                                                    {models.map((m) => (<option key={m.id} value={m.id}>{m.id}</option>))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] text-gray-500 uppercase tracking-tighter">Grammar</label>
                                                <select
                                                    value={formState.aiFeatures.transcription.grammarModel}
                                                    onChange={(e) => {
                                                        const t = formState.aiFeatures.transcription;
                                                        setFormState({
                                                            ...formState,
                                                            aiFeatures: { ...formState.aiFeatures, transcription: { ...t, grammarModel: e.target.value } }
                                                        });
                                                    }}
                                                    className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[10px] text-white"
                                                >
                                                    {models.map((m) => (<option key={m.id} value={m.id}>{m.id}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Editor Section */}
                    <div className="space-y-4 border-t border-white/10 pt-4">
                        <label className="text-sm font-bold text-gray-200">Editor</label>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">Font Family</label>
                            <select
                                value={formState.editorFont || "inter"}
                                onChange={(e) => setFormState({ ...formState, editorFont: e.target.value as any })}
                                className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                            >
                                <option value="inter">Modern Sans (Inter/Outfit)</option>
                                <option value="mono">Developer Mono</option>
                                <option value="pixel">Retro Pixel (Pixelify)</option>
                            </select>
                        </div>
                    </div>

                    {/* Github Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex justify-between">
                            GitHub Personal Token
                            <a
                                href="https://github.com/settings/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 text-xs flex items-center gap-1 hover:underline"
                            >
                                Get Token <ExternalLink size={10} />
                            </a>
                        </label>
                        <input
                            type="password"
                            value={formState.githubApiKey}
                            onChange={(e) =>
                                setFormState({ ...formState, githubApiKey: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                            placeholder="ghp_..."
                        />
                        <p className="text-xs text-gray-500">
                            Required for syncing notes to your repository.
                        </p>
                    </div>

                    {/* Repo Section */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                            GitHub Repository (username/repo)
                        </label>
                        <input
                            type="text"
                            value={formState.githubRepo}
                            onChange={(e) =>
                                setFormState({ ...formState, githubRepo: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                            placeholder="e.g. justk/my-notes"
                        />
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
