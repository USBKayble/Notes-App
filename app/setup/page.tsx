"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SetupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [github, setGithub] = useState({ token: "", owner: "", repo: "" });
    const [mistral, setMistral] = useState({ apiKey: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ github, mistral }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Success - Redirect to Dashboard
            router.push("/");
            router.refresh();

        } catch (err: any) {
            setError(err.message || "Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Connect Your Apps</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Configure your GitHub and Mistral connections to start using the app.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                GitHub Integration
                            </h3>
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Personal Access Token (PAT)</label>
                                    <input
                                        type="password"
                                        required
                                        className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="ghp_..."
                                        value={github.token}
                                        onChange={e => setGithub({ ...github, token: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Owner / Org</label>
                                        <input
                                            required
                                            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                                            placeholder="username"
                                            value={github.owner}
                                            onChange={e => setGithub({ ...github, owner: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Repository</label>
                                        <input
                                            required
                                            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                                            placeholder="notes-repo"
                                            value={github.repo}
                                            onChange={e => setGithub({ ...github, repo: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t my-4 py-4 space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                Mistral AI
                            </h3>
                            <div className="space-y-2">
                                <label className="text-xs font-medium">API Key</label>
                                <input
                                    type="password"
                                    required
                                    className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    placeholder="key_..."
                                    value={mistral.apiKey}
                                    onChange={e => setMistral({ apiKey: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow h-9 px-4 py-2"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save & Connect"}
                    </button>
                </form>
            </div>
        </div>
    );
}
