"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type AIFeatureState = "off" | "suggest" | "apply";

export interface AppSettings {
    mistralApiKey: string;
    githubApiKey: string;
    githubRepo: string; // "owner/repo"
    selectedModel: string;      // General Chat fallback

    // AI Feature Configuration
    aiFeatures: {
        transcription: { state: AIFeatureState; model: string; cleanupModel: string; grammarModel: string };
        grammar: { state: AIFeatureState; model: string };
        organization: { state: AIFeatureState; model: string };
        summarization: { state: AIFeatureState; model: string };
        media: { state: AIFeatureState; model: string; ocrModel: string };
    };

    editorFont: 'inter' | 'mono' | 'pixel';
}

const DEFAULT_SETTINGS: AppSettings = {
    mistralApiKey: "",
    githubApiKey: "",
    githubRepo: "",
    selectedModel: "mistral-large-latest",

    aiFeatures: {
        transcription: {
            state: "off",
            model: "voxtral-mini-2507",
            cleanupModel: "mistral-small-latest",
            grammarModel: "mistral-small-latest"
        },
        grammar: { state: "suggest", model: "mistral-small-latest" },
        organization: { state: "off", model: "mistral-small-latest" },
        summarization: { state: "suggest", model: "mistral-large-latest" },
        media: { state: "apply", model: "pixtral-12b-2409", ocrModel: "mistral-ocr-latest" },
    },

    editorFont: "inter"
};

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("mistral-notes-settings");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Deep merge aiFeatures to ensure new keys/defaults are preserved
                    const mergedSettings = {
                        ...DEFAULT_SETTINGS,
                        ...parsed,
                        aiFeatures: {
                            ...DEFAULT_SETTINGS.aiFeatures,
                            ...(parsed.aiFeatures || {})
                        }
                    };
                    // Ensure each feature also has its defaults if partially saved
                    Object.keys(DEFAULT_SETTINGS.aiFeatures).forEach(k => {
                        const key = k as keyof typeof DEFAULT_SETTINGS.aiFeatures;
                        // @ts-ignore
                        if (mergedSettings.aiFeatures[key]) {
                            // @ts-ignore
                            mergedSettings.aiFeatures[key] = {
                                ...DEFAULT_SETTINGS.aiFeatures[key],
                                ...mergedSettings.aiFeatures[key]
                            };
                        }
                    });

                    setSettings(mergedSettings);
                } catch (e) {
                    console.error("Failed to parse settings", e);
                }
            }
            setLoading(false);
        }
    }, []);

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...newSettings };
            if (typeof window !== "undefined") {
                localStorage.setItem("mistral-notes-settings", JSON.stringify(next));
            }
            return next;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}
