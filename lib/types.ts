export interface FileNode {
    path: string;
    name: string;
    type: "file" | "dir";
    children?: FileNode[];
}

export interface NoteItem {
    id: string;
    slug: string;
    title: string;
    updatedAt: string;
}
