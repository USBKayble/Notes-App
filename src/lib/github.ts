import { Octokit } from "octokit";

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

        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Update ${path} via Mistral Notes`,
            content: btoa(content), // buffer conversion validation needed for unicode
            sha: fileSha,
        });
    } catch (e) {
        console.error("Failed to save file");
        throw e;
    }
};
