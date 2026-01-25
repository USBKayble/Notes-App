"use client";

import React, { useState, useEffect } from "react";
import { Folder, FileText, RefreshCw, ChevronLeft, Plus, X, GitBranch, Image as ImageIcon, MoreVertical, Trash2, Tag } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "next-auth/react";
import { listRepoFiles, FileItem, listUserRepos, createRepo, RepoItem, saveFileContent, createFolder, renameFile, getNote, saveNote, deleteFile } from "@/lib/github";
import TagEditor from "./TagEditor";

interface FileExplorerProps {
    onSelectFile: (path: string) => void;
    className?: string;
}

export default function FileExplorer({ onSelectFile, className = "" }: FileExplorerProps) {
    const { settings, updateSettings } = useSettings();
    const { data: session } = useSession();
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

    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);

    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [tagEditingPath, setTagEditingPath] = useState<string | null>(null);
    const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);

    useEffect(() => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (token) {
            listUserRepos(token).then(setRepos);
        }
    }, [session]);

    const handleCreateRepo = async () => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!newRepoName.trim() || !token) return;
        setCreating(true);
        const newRepo = await createRepo(token, newRepoName);
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
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!newFileName.trim() || !token || !settings.githubRepo) return;
        setCreatingFile(true);
        const [owner, repo] = settings.githubRepo.split("/");

        let fileName = newFileName.trim();
        // Force .md extension for new notes if not present
        if (!fileName.toLowerCase().endsWith('.md')) {
            fileName += '.md';
        }

        const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;

        try {
            await saveFileContent(token, owner, repo, fullPath, "---\ntitle: New Note\ncreated_at: " + new Date().toISOString() + "\n---\n\n# New Note\n");
            setIsCreatingFile(false);
            setNewFileName("");
            loadFiles(currentPath);
            onSelectFile(fullPath);
        } catch {
            setError("Failed to create file");
        } finally {
            setCreatingFile(false);
        }
    };

    const handleCreateFolder = async () => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!newFolderName.trim() || !token || !settings.githubRepo) return;
        setCreatingFolder(true);
        const [owner, repo] = settings.githubRepo.split("/");
        const fullPath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;

        try {
            await createFolder(token, owner, repo, fullPath);
            setIsCreatingFolder(false);
            setNewFolderName("");
            loadFiles(currentPath);
        } catch {
            setError("Failed to create folder");
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleRename = async () => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!renameValue.trim() || !renamingPath || !token || !settings.githubRepo) return;

        try {
            const [owner, repo] = settings.githubRepo.split("/");
            let newName = renameValue.trim();
            // Simple assumption: if it's a note (renamingPath ends in .md), ensure new name has .md
            if (renamingPath.endsWith('.md') && !newName.toLowerCase().endsWith('.md')) {
                newName += '.md';
            }

            const parent = renamingPath.substring(0, renamingPath.lastIndexOf('/'));
            const newPath = parent ? `${parent}/${newName}` : newName;

            if (newPath !== renamingPath) {
                // Fetch the note to update its internal title
                const note = await getNote(token, owner, repo, renamingPath);

                if (note) {
                    // Update title in metadata to match new filename (without extension)
                    const displayTitle = newName.replace(/\.(md|txt)$/, '');
                    note.metadata.title = displayTitle;
                    note.path = newPath; // Set new path

                    // Save as new file with updated content
                    await saveNote(token, owner, repo, note);

                    // Delete old file
                    await deleteFile(token, owner, repo, renamingPath);
                } else {
                    // Fallback to simple rename if parsing fails
                    await renameFile(token, owner, repo, renamingPath, newPath);
                }
            }
            setRenamingPath(null);
            loadFiles(currentPath);
        } catch (e) {
            setError("Failed to rename");
            console.error(e);
        }
    };

    const handleDelete = async (path: string) => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!token || !settings.githubRepo || !confirm("Are you sure you want to delete this note?")) return;

        try {
            const [owner, repo] = settings.githubRepo.split("/");
            await deleteFile(token, owner, repo, path);
            loadFiles(currentPath);
            setMenuOpenPath(null);
        } catch {
            setError("Failed to delete file");
        }
    };

    const loadFiles = React.useCallback(async (path: string) => {
        const token = (session as unknown as { accessToken?: string })?.accessToken;
        if (!token || !settings.githubRepo) {
            setError("Sign in with GitHub to view files.");
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
            const items = await listRepoFiles(token, owner, repo, path);
            const filteredItems = items.filter(item => {
                if (item.type === 'dir') {
                    return item.name !== 'assets' && !item.name.startsWith('.');
                }
                return item.name.endsWith('.md') || item.name.endsWith('.txt');
            });

            filteredItems.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
            setFiles(filteredItems);
            setCurrentPath(path);
        } catch {
            setError("Failed to load files.");
        } finally {
            setLoading(false);
        }
    }, [session, settings.githubRepo]);

    useEffect(() => {
        if (session && settings.githubRepo) {
            loadFiles("");
        }
    }, [loadFiles, session, settings.githubRepo]);

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
                                        } else if (e.target.value === "___NEW_FOLDER___") {
                                            setIsCreatingFolder(true);
                                        } else {
                                            updateSettings({ githubRepo: e.target.value });
                                        }
                                    }}
                                    className="appearance-none bg-white/5 hover:bg-white/10 text-[11px] font-medium text-foreground focus:outline-none cursor-pointer rounded-md pl-2 pr-6 h-7 w-full border border-white/5 transition-colors"
                                >
                                    <option value="" disabled className="bg-[#111115] text-gray-400">Select Repository...</option>
                                    <option value="___CREATE_NEW___" className="bg-[#111115] text-blue-400 font-bold">+ Create New Private Repo</option>
                                    <option value="___NEW_FILE___" className="bg-[#111115] text-green-400 font-bold">+ New File</option>
                                    <option value="___NEW_FOLDER___" className="bg-[#111115] text-yellow-400 font-bold">+ New Folder</option>
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
                    if (e.target === e.currentTarget) {
                        setIsCreatingFile(true);
                    }
                }}
            >
                {error && <div className="text-red-400 text-xs p-3 text-center bg-red-500/10 rounded-lg mx-2 border border-red-500/20">{error}</div>}

                {/* Create File Input */}
                {isCreatingFile && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-primary/30 animate-in fade-in slide-in-from-top-1 duration-200">
                        <FileText size={18} className="text-primary animate-pulse" />
                        <input
                            autoFocus
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder="note-title"
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

                {/* Create Folder Input */}
                {isCreatingFolder && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-secondary/30 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Folder size={18} className="text-secondary animate-pulse" />
                        <input
                            autoFocus
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="folder-name"
                            className="bg-transparent border-none text-sm text-foreground focus:outline-none flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                                if (e.key === 'Escape') setIsCreatingFolder(false);
                            }}
                            onBlur={() => !creatingFolder && newFolderName === "" && setIsCreatingFolder(false)}
                        />
                        {creatingFolder ? (
                            <RefreshCw size={14} className="animate-spin text-secondary" />
                        ) : (
                            <button onClick={handleCreateFolder} className="text-secondary hover:text-secondary/80">
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                )}


                {!session && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs gap-2 w-full p-4 text-center">
                        <p>Sign in to browse files.</p>
                    </div>
                )}

                {tagEditingPath && (
                    <TagEditor path={tagEditingPath} onClose={() => setTagEditingPath(null)} />
                )}

                {files.map((file) => (
                    <div
                        key={file.path}
                        className="relative group w-full"
                        onMouseLeave={() => {
                            // Only close if it's the menu, not the tag editor
                            setMenuOpenPath(null);
                        }}
                    >
                        {renamingPath === file.path ? (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-primary/50">
                                {file.type === "dir" ? <Folder size={18} className="text-secondary" /> : <FileText size={18} className="text-primary" />}
                                <input
                                    autoFocus
                                    className="bg-transparent text-sm text-foreground focus:outline-none w-full"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleRename}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename();
                                        if (e.key === 'Escape') setRenamingPath(null);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="relative flex items-center">
                                <button
                                    onClick={() => {
                                        if (file.type === "dir") {
                                            handleNavigate(file.path);
                                        } else {
                                            onSelectFile(file.path);
                                        }
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (file.type !== "dir") { // Only allow renaming notes for now, or dirs too? Let's allow notes.
                                            setRenamingPath(file.path);
                                            setRenameValue(file.name.replace(/\.(md|txt)$/, ''));
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-left transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/5 pr-8"
                                >
                                    {file.type === "dir" ? (
                                        file.name === "assets" ? (
                                            <ImageIcon size={18} className="text-pink-400 opacity-80 group-hover:opacity-100 transition-transform" />
                                        ) : (
                                            <Folder size={18} className="text-secondary opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                                        )
                                    ) : (
                                        <FileText size={18} className="text-muted-foreground opacity-70 group-hover:text-foreground group-hover:opacity-100 transition-colors" />
                                    )}
                                    <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                                        {file.name.replace(/\.(md|txt)$/, '')}
                                    </span>
                                </button>

                                {/* Context Menu Trigger */}
                                {file.type !== "dir" && (
                                    <div className="absolute right-2 text-foreground">
                                        <div className={`transition-opacity ${menuOpenPath === file.path ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpenPath(menuOpenPath === file.path ? null : file.path);
                                                }}
                                                className={`p-1 rounded hover:bg-white/10 ${menuOpenPath === file.path ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                <MoreVertical size={14} />
                                            </button>
                                        </div>

                                        {/* Dropdown Menu */}
                                        {menuOpenPath === file.path && (
                                            <div className="absolute right-0 top-6 w-32 bg-[#111115] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTagEditingPath(file.path);
                                                        setMenuOpenPath(null);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 text-left"
                                                >
                                                    <Tag size={12} />
                                                    Edit Tags
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(file.path);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 text-left border-t border-white/5"
                                                >
                                                    <Trash2 size={12} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {!loading && files.length === 0 && !error && session && (
                    <div className="text-muted-foreground text-xs text-center mt-8 italic opacity-50">Empty directory</div>
                )}
            </div>
        </div>
    );
}
