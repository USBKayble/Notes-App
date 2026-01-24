export interface NoteMetadata {
    title?: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}

export interface Note {
    content: string;
    metadata: NoteMetadata;
    path: string;
    sha?: string;
}
