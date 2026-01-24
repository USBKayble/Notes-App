"use client";

import React, { useState } from "react";
import { useSettings, AIFeatureState } from "@/hooks/useSettings";
import { ChevronDown } from "lucide-react";

interface AIToggleIconProps {
    feature: keyof ReturnType<typeof useSettings>["settings"]["aiFeatures"];
    icon: React.ReactNode;
    label: string;
    allowedStates?: AIFeatureState[];
}

export default function AIToggleIcon({ feature, icon, label, allowedStates = ["off", "suggest", "apply"] }: AIToggleIconProps) {
    const { settings, updateSettings } = useSettings();
    const [showDropdown, setShowDropdown] = useState(false);

    const config = settings.aiFeatures[feature];
    const state = config.state;

    const cycleState = () => {
        const states: AIFeatureState[] = allowedStates;
        const nextState = states[(states.indexOf(state) + 1) % states.length];

        updateSettings({
            aiFeatures: {
                ...settings.aiFeatures,
                [feature]: { ...config, state: nextState }
            }
        });
    };

    const getStatusColor = () => {
        switch (state) {
            case "apply": return "text-green-400 bg-green-400/10 border-green-400/20";
            case "suggest": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
            default: return "text-muted-foreground hover:text-foreground border-transparent";
        }
    };

    return (
        <div className="relative group/ai">
            <button
                onClick={cycleState}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setShowDropdown(!showDropdown);
                }}
                className={`glass-button p-1.5 rounded-md flex items-center gap-1 transition-all duration-300 border ${getStatusColor()} group/btn`}
                title={`${label}: ${state}\nRight-click for models`}
            >
                {icon}
                <ChevronDown size={10} className="opacity-0 group-hover/btn:opacity-50" />
            </button>

            {showDropdown && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowDropdown(false)} />
                    <div className="absolute top-full right-0 mt-2 z-[70] glass-panel p-3 rounded-xl border border-white/10 shadow-2xl min-w-[200px] bg-[#111115]">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">{label} Settings</h4>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[9px] text-gray-400">Current Model</label>
                                <div className="text-[11px] text-purple-300 bg-purple-500/10 px-2 py-1.5 rounded border border-purple-500/20 break-all font-mono">
                                    {config.model || "Not set"}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowDropdown(false);
                                    // Could trigger opening the main settings modal here if needed
                                }}
                                className="w-full text-center text-[10px] text-gray-500 hover:text-white transition-colors py-1"
                            >
                                Open Full Settings to Change
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
