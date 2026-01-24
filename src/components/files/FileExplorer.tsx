"use client";

import React, { useState, useEffect } from "react";
import { Folder, FileText, RefreshCw, ChevronLeft, Plus, X, GitBranch, Lock } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { listRepoFiles, FileItem, listUserRepos, createRepo, RepoItem, saveFileContent } from "@/lib/github";

interface FileExplorerProps {
    onSelectFile: (path: string) => void;
    className?: string;
}

export default function FileExplorer({ onSelectFile, className = "" }: FileExplorerProps) {
    const { settings, updateSettings } = useSettings();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [currentPath, setCurrentPath] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [repos, setRepos] = useState<RepoItem[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newRepoName, setNewRepoName] = useState("");
    const [creating, setCreating] = useState(false);

    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [creatingFile, setCreatingFile] = useState(false);

    useEffect(() => {
        if (settings.githubApiKey) {
            listUserRepos(settings.githubApiKey).then(setRepos);
        }
    }, [settings.githubApiKey]);

    const handleCreateRepo = async () => {
        if (!newRepoName.trim() || !settings.githubApiKey) return;
        setCreating(true);
        const newRepo = await createRepo(settings.githubApiKey, newRepoName);
        if (newRepo) {
            setRepos(prev => [newRepo, ...prev]);
            updateSettings({ githubRepo: newRepo.full_name });
            setIsCreating(false);
            setNewRepoName("");
        } else {
            setError("Failed to create repository");
        }
        setCreating(false);
    };

    const handleCreateFile = async () => {
        if (!newFileName.trim() || !settings.githubApiKey || !settings.githubRepo) return;
        setCreatingFile(true);
        const [owner, repo] = settings.githubRepo.split("/");
        const fullPath = currentPath ? `${currentPath}/${newFileName}` : newFileName;

        try {
            await saveFileContent(settings.githubApiKey, owner, repo, fullPath, "# New File\n");
            setIsCreatingFile(false);
            setNewFileName("");
            loadFiles(currentPath);
            onSelectFile(fullPath);
        } catch (err) {
            setError("Failed to create file");
        } finally {
            setCreatingFile(false);
        }
    };

    const loadFiles = React.useCallback(async (path: string) => {
        if (!settings.githubApiKey || !settings.githubRepo) {
            setError("Configure GitHub settings first.");
            return;
        }
        setLoading(true);
        setError("");
        const [owner, repo] = settings.githubRepo.split("/");
        if (!owner || !repo) {
            setError("Invalid Repo format (owner/repo)");
            setLoading(false);
            return;
        }

        try {
            const items = await listRepoFiles(settings.githubApiKey, owner, repo, path);
            items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
            setFiles(items);
            setCurrentPath(path);
        } catch {
            setError("Failed to load files.");
        } finally {
            setLoading(false);
        }
    }, [settings.githubApiKey, settings.githubRepo]);

    useEffect(() => {
        if (settings.githubApiKey && settings.githubRepo) {
            loadFiles("");
        }
    }, [loadFiles, settings.githubApiKey, settings.githubRepo]);

    const handleNavigate = (path: string) => {
        loadFiles(path);
    };

    const handleUp = () => {
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        handleNavigate(parts.join("/"));
    };

    return (
        <div className={`flex flex-col h-full bg-transparent ${className}`}>
            {/* Header */}
            <div className="p-3 pb-2 flex items-center justify-between text-xs sticky top-0 z-10 bg-gradient-to-b from-black/20 to-transparent">
                <div className="flex items-center gap-1.5 overflow-hidden font-medium text-muted-foreground flex-1">
                    {currentPath && (
                        <button onClick={handleUp} className="p-1 hover:bg-white/10 rounded-md transition-colors text-foreground">
                            <ChevronLeft size={16} />
                        </button>
                    )}

                    {isCreating ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0 animate-in fade-in zoom-in duration-200">
                            <input
                                autoFocus
                                value={newRepoName}
                                onChange={(e) => setNewRepoName(e.target.value)}
                                placeholder="New private repo..."
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 w-full min-w-[120px]"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateRepo()}
                            />
                            <button onClick={handleCreateRepo} disabled={creating} className="p-1 hover:text-primary transition-colors">
                                {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                            </button>
                            <button onClick={() => setIsCreating(false)} className="p-1 hover:text-red-400 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1 group/repo">
                            <div className="relative flex-1 max-w-[180px]">
                                <select
                                    value={settings.githubRepo || ""}
                                    onChange={(e) => {
                                        if (e.target.value === "___CREATE_NEW___") {
                                            setIsCreating(true);
                                        } else if (e.target.value === "___NEW_FILE___") {
                                            setIsCreatingFile(true);
                                        } else {
                                            updateSettings({ githubRepo: e.target.value });
                                        }
                                    }}
                                    className="appearance-none bg-white/5 hover:bg-white/10 text-[11px] font-medium text-foreground focus:outline-none cursor-pointer rounded-md pl-2 pr-6 h-7 w-full border border-white/5 transition-colors"
                                >
                                    <option value="" disabled className="bg-[#111115] text-gray-400">Select Repository...</option>
                                    <option value="___CREATE_NEW___" className="bg-[#111115] text-blue-400 font-bold">+ Create New Private Repo</option>
                                    <option value="___NEW_FILE___" className="bg-[#111115] text-green-400 font-bold">+ New File in {currentPath || "/"}</option>
                                    <optgroup label="Your Repositories" className="bg-[#111115] text-gray-500">
                                        {repos.map(r => (
                                            <option key={r.full_name} value={r.full_name} className="bg-[#111115] text-gray-200">
                                                {r.full_name} {r.private ? "🔒" : ""}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                    <GitBranch size={10} />
                                </div>
                            </div>
                            <div className="text-[10px] opacity-30 truncate px-1 font-mono whitespace-nowrap hidden sm:block">{currentPath || "/"}</div>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => loadFiles(currentPath)}
                    className={`p-1.5 hover:bg-white/10 rounded-md transition-colors ${loading ? "animate-spin text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="Refresh"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Content */}
            <div
                className="flex-1 overflow-y-auto p-2 space-y-0.5"
                onDoubleClick={(e) => {
                    // Only trigger if clicking the container itself, not a child button/file
                    if (e.target === e.currentTarget) {
                        setIsCreatingFile(true);
                    }
                }}
            >
                {error && <div className="text-red-400 text-xs p-3 text-center bg-red-500/10 rounded-lg mx-2 border border-red-500/20">{error}</div>}

                {isCreatingFile && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-primary/30 animate-in fade-in slide-in-from-top-1 duration-200">
                        <FileText size={18} className="text-primary animate-pulse" />
                        <input
                            autoFocus
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder="filename.md"
                            className="bg-transparent border-none text-sm text-foreground focus:outline-none flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFile();
                                if (e.key === 'Escape') setIsCreatingFile(false);
                            }}
                            onBlur={() => !creatingFile && newFileName === "" && setIsCreatingFile(false)}
                        />
                        {creatingFile ? (
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        ) : (
                            <button onClick={handleCreateFile} className="text-primary hover:text-primary/80">
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                )}

                {!settings.githubApiKey && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs gap-2 w-full p-4 text-center">
                        <p>Connect GitHub to browse files.</p>
                    </div>
                )}

                {files.map((file) => (
                    <button
                        key={file.path}
                        onClick={() => {
                            if (file.type === "dir") {
                                handleNavigate(file.path);
                            } else {
                                onSelectFile(file.path);
                            }
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-left transition-all duration-200 group hover:bg-white/5 border border-transparent hover:border-white/5"
                    >
                        {file.type === "dir" ? (
                            <Folder size={18} className="text-secondary opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                        ) : (
                            <FileText size={18} className="text-muted-foreground opacity-70 group-hover:text-foreground group-hover:opacity-100 transition-colors" />
                        )}
                        <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors font-medium">{file.name}</span>
                    </button>
                ))}

                {!loading && files.length === 0 && !error && settings.githubApiKey && (
                    <div className="text-muted-foreground text-xs text-center mt-8 italic opacity-50">Empty directory</div>
                )}
            </div>
        </div>
    );
}
