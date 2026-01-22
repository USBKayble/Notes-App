import { Octokit } from "@octokit/rest";
import { getConfig } from "./session";

// Instantiate Octokit on demand or cached?
// Since we need request-scope config, we should probably instantiate per request 
// or pass the config to helper functions.
// To avoid rewriting every call site immediately, we could make these functions
// fetch the config internally. Since `cookies()` is request-scoped, this works on server.

async function getClient() {
    const config = await getConfig();
    if (!config?.github) {
        throw new Error("GitHub Not Configured");
    }
    return {
        octokit: new Octokit({ auth: config.github.token }),
        owner: config.github.owner,
        repo: config.github.repo,
    };
}

export type FileContent = {
    path: string;
    content: string; // Base64 or utf-8 depending on usage
    encoding: "utf-8" | "base64";
};

export async function getFile(path: string) {
    try {
        const { octokit, owner, repo } = await getClient();
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        // Check if it's a file
        if (!Array.isArray(data) && data.type === "file") {
            return data;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching file ${path}:`, error);
        return null;
    }
}

export async function saveFile(path: string, content: string, message: string) {
    try {
        const { octokit, owner, repo } = await getClient();

        // 1. Get the current SHA if the file exists (to update)
        let sha: string | undefined;
        try {
            const existing = await getFile(path);
            sha = existing?.sha;
        } catch {
            // ignore
        }

        // 2. Create or Update
        const { data } = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message,
            content: Buffer.from(content).toString("base64"),
            sha,
        });

        return data;
    } catch (error) {
        console.error(`Error saving file ${path}:`, error);
        throw error;
    }
}

export async function listFiles(path: string) {
    try {
        const { octokit, owner, repo } = await getClient();
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        if (Array.isArray(data)) {
            return data;
        }
        return [];
    } catch (error) {
        console.error(`Error listing files in ${path}:`, error);
        return [];
    }
}

export async function getRepoTree(recursive: boolean = true) {
    try {
        const { octokit, owner, repo } = await getClient();
        const { data: repoData } = await octokit.rest.repos.get({
            owner,
            repo,
        });
        const defaultBranch = repoData.default_branch;

        const { data: refData } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${defaultBranch}`,
        });
        const treeSha = refData.object.sha;

        const { data } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: recursive ? "1" : "0",
        });

        return data.tree;
    } catch (error) {
        console.error("Error fetching repo tree:", error);
        return [];
    }
}
