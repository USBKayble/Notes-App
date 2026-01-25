import { Octokit } from "octokit";
import matter from "gray-matter";
import { Note } from "./types";

export const getOctokit = (token: string) => {
    if (!token) return null;
    return new Octokit({ auth: token });
};

export interface FileItem {
    name: string;
    path: string;
    type: "file" | "dir";
    sha: string;
}

export interface RepoItem {
    name: string;
    full_name: string;
    private: boolean;
    updated_at: string | null;
}

export const listUserRepos = async (token: string): Promise<RepoItem[]> => {
    if (token === 'mock_access_token') {
        return [{
            name: "local-notes",
            full_name: "local/notes",
            private: true,
            updated_at: new Date().toISOString()
        }];
    }

    const octokit = getOctokit(token);
    if (!octokit) return [];

    try {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            visibility: 'all'
        });

        return data.map(repo => ({
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            updated_at: repo.updated_at ?? null
        }));
    } catch (e) {
        console.error("Failed to list repos", e);
        return [];
    }
};

export const createRepo = async (token: string, name: string): Promise<RepoItem | null> => {
    if (token === 'mock_access_token') {
        return {
            name: name,
            full_name: `local/${name}`,
            private: true,
            updated_at: new Date().toISOString()
        };
    }

    const octokit = getOctokit(token);
    if (!octokit) return null;

    try {
        const { data } = await octokit.rest.repos.createForAuthenticatedUser({
            name,
            private: true,
            auto_init: true // create README so it's not empty
        });

        return {
            name: data.name,
            full_name: data.full_name,
            private: data.private,
            updated_at: data.updated_at
        };
    } catch (e) {
        console.error("Failed to create repo", e);
        return null;
    }
};

export const listRepoFiles = async (token: string, owner: string, repo: string, path = ""): Promise<FileItem[]> => {
    if (token === 'mock_access_token') {
        if (typeof window === 'undefined') return [];
        const files: FileItem[] = [];
        // Scan localStorage for keys starting with mock_fs:
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('mock_fs:')) {
                const filePath = key.replace('mock_fs:', '');
                // Simple flat list simulation for now (or basic folder filtering)
                // If path is root (""), show top level files.
                // If path is "dir", show files starting with "dir/"

                if (path === "") {
                    // Root items: those without '/' or with only one part
                    if (filePath.includes("/")) continue; // simplified: only root files support for demo or flattening
                    files.push({
                        name: filePath,
                        path: filePath,
                        type: "file",
                        sha: "mock-sha"
                    });
                } else {
                    if (filePath.startsWith(path + "/")) {
                        // sub item
                        const subPath = filePath.replace(path + "/", "");
                        if (!subPath.includes("/")) {
                            files.push({
                                name: subPath,
                                path: filePath,
                                type: "file",
                                sha: "mock-sha"
                            });
                        }
                    }
                }
            }
        }
        // Add a demo file if empty
        if (files.length === 0 && path === "") {
            files.push({ name: "Welcome.md", path: "Welcome.md", type: "file", sha: "demo" });
            localStorage.setItem('mock_fs:Welcome.md', '# Welcome to Local Notes\nThis is a mock note stored in LocalStorage.');
        }
        return files;
    }

    const octokit = getOctokit(token);
    if (!octokit) return [];

    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        if (Array.isArray(data)) {
            return data
                .filter((item) => item.type === "file" || item.type === "dir")
                .map((item) => ({
                    name: item.name,
                    path: item.path,
                    type: item.type as "file" | "dir",
                    sha: item.sha
                }));
        }
        return [];
    } catch {
        console.error("Failed to list files");
        return [];
    }
};

export const getFileContent = async (token: string, owner: string, repo: string, path: string): Promise<string> => {
    if (token === 'mock_access_token') {
        if (typeof window === 'undefined') return "";
        return localStorage.getItem(`mock_fs:${path}`) || "";
    }

    const octokit = getOctokit(token);
    if (!octokit) return "";
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        if ('content' in data) {
            return atob(data.content); // basic base64 decode for small files
        }
        return "";
    } catch {
        // console.error("Failed to get content", e);
        return "";
    }
};

export const saveFileContent = async (token: string, owner: string, repo: string, path: string, content: string, sha?: string) => {
    if (token === 'mock_access_token') {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`mock_fs:${path}`, content);
        return;
    }

    const octokit = getOctokit(token);
    if (!octokit) throw new Error("No token");

    try {
        // If sha not provided, try to get it first (for update)
        let fileSha = sha;
        if (!fileSha) {
            try {
                const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
                if ('sha' in data) fileSha = data.sha;
            } catch {
                // File might not exist, which is fine for create
            }
        }

        // Helper for Unicode-safe Base64
        const toBase64 = (str: string) => {
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(str).toString('base64');
            }
            return btoa(unescape(encodeURIComponent(str)));
        };

        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Update ${path} via Mistral Notes`,
            content: toBase64(content),
            sha: fileSha,
        });
    } catch (e) {
        console.error("Failed to save file");
        throw e;
    }
};

export const getNote = async (token: string, owner: string, repo: string, path: string): Promise<Note | null> => {
    const content = await getFileContent(token, owner, repo, path);
    if (!content) return null;

    try {
        const { data, content: markdownContent } = matter(content);
        return {
            content: markdownContent,
            metadata: data,
            path,
            // sha is not easily available here unless we return it from getFileContent, 
            // but we can fetch it separately or modify getFileContent if needed.
            // For now, let's assume we handle sha in saveFileContent logic.
        };
    } catch (e) {
        console.error("Failed to parse frontmatter", e);
        // Fallback for files without frontmatter
        return {
            content,
            metadata: {},
            path
        };
    }
};

export const saveNote = async (token: string, owner: string, repo: string, note: Note) => {
    const fileContent = matter.stringify(note.content, note.metadata);
    await saveFileContent(token, owner, repo, note.path, fileContent, note.sha);
};

export const uploadAsset = async (token: string, owner: string, repo: string, path: string, file: File): Promise<string | null> => {
    if (token === 'mock_access_token') {
        // Warning: LocalStorage has 5MB limit. This is only for small tests.
        try {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            // Store with data URI prefix so it can be rendered if we had an img component that read it
            // but here we just store the content. 
            // Ideally we might want to store as data url: `data:${file.type};base64,${base64}`
            localStorage.setItem(`mock_fs:${path}`, "data:" + file.type + ";base64," + base64);
            return path;
        } catch {
            return null;
        }
    }

    const octokit = getOctokit(token);
    if (!octokit) return null;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Upload asset ${path}`,
            content: base64,
        });

        return path;
    } catch (e) {
        console.error("Failed to upload asset", e);
        return null;
    }
};

export const createFolder = async (token: string, owner: string, repo: string, path: string) => {
    // GitHub doesn't have real folders, so we create a .gitkeep file inside it
    await saveFileContent(token, owner, repo, `${path}/.gitkeep`, "", undefined);
};

export const deleteFile = async (token: string, owner: string, repo: string, path: string, sha?: string) => {
    if (token === 'mock_access_token') {
        localStorage.removeItem(`mock_fs:${path}`);
        return;
    }

    const octokit = getOctokit(token);
    if (!octokit) return;

    try {
        let fileSha = sha;
        if (!fileSha) {
            try {
                const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
                if ('sha' in data) fileSha = data.sha;
            } catch {
                return; // File doesn't exist
            }
        }

        if (!fileSha) return;

        await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path,
            message: `Delete ${path}`,
            sha: fileSha
        });
    } catch (e) {
        console.error("Failed to delete file", e);
        throw e;
    }
};

export const renameFile = async (token: string, owner: string, repo: string, oldPath: string, newPath: string) => {
    // 1. Get content of old file
    const content = await getFileContent(token, owner, repo, oldPath);

    // 2. Create new file with content
    await saveFileContent(token, owner, repo, newPath, content);

    // 3. Delete old file
    await deleteFile(token, owner, repo, oldPath);
};
