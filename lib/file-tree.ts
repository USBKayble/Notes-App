import { FileNode } from "./types";

interface GitHubTreeItem {
    path?: string;
    type?: string; // "blob" | "tree"
    sha?: string;
    url?: string;
}

export function buildFileTree(items: GitHubTreeItem[]): FileNode[] {
    const root: FileNode[] = [];
    const map: Record<string, FileNode> = {};

    // Sort items so folders come first (optional, but good for creation order if needed)
    // Actually, we just iterate.

    items.forEach((item) => {
        if (!item.path) return;

        // Split path into segments
        const parts = item.path.split("/");
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            // Check if node exists at this level
            let existingNode = currentLevel.find((n) => n.name === part);

            if (!existingNode) {
                const isDir = item.type === "tree" || (index < parts.length - 1);
                // Note: GitHub tree items with type "tree" are explicit directories.
                // Items with type "blob" are files.
                // Intermediate paths in a blob's path string are implicit folders.

                // If we rely on recursive tree, we get explicit tree entries for folders.
                // But if an item is "a/b/c.txt", we might process "a" then "b" then "c.txt".
                // We need to ensure we don't duplicate if "a" was already added as a "tree" entry.

                // Wait, recursive tree returns ALL entries.
                // "a" (tree)
                // "a/b" (tree)
                // "a/b/c.txt" (blob)
                // So we should see "a" first? Not guaranteed order.

                // Better strategy: Use the map to lookup using full path.

                existingNode = {
                    name: part,
                    path: currentPath,
                    type: (index === parts.length - 1 && item.type === "blob") ? "file" : "dir",
                    children: [],
                };

                // Try to find parent in map?
                if (index === 0) {
                    root.push(existingNode);
                } else {
                    const parentPath = parts.slice(0, index).join("/");
                    const parent = map[parentPath];
                    if (parent) {
                        parent.children = parent.children || [];
                        // Check if already added by a previous blob with same path segment?
                        const childExists = parent.children.find(c => c.name === part);
                        if (!childExists) {
                            parent.children.push(existingNode);
                        } else {
                            existingNode = childExists;
                        }
                    } else {
                        // Parent not found yet? This implies out of order.
                        // If out of order, we might need a robust builder that creates parents on demand.
                        // But we can simplify: Just map valid paths.
                        // For now, let's assume we can add it to a temporary map and link later?
                        // Or just use the standard "create if missing" loop approach.
                    }
                }
                map[currentPath] = existingNode;
            }

            // Descend
            if (existingNode.type === "dir" && existingNode.children) {
                currentLevel = existingNode.children;
            }
        });
    });

    return root;
}
