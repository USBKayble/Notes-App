import Dexie, { Table } from 'dexie';

export interface LocalNote {
    path: string;
    content: string;
    updatedAt: number;
    syncStatus: "synced" | "dirty";
}

export interface PendingOp {
    id?: number;
    type: "save";
    path: string;
    content: string;
    timestamp: number;
}

export class NotesDatabase extends Dexie {
    notes!: Table<LocalNote, string>; // Primary key is path
    pendingOps!: Table<PendingOp, number>; // Auto-increment ID

    constructor() {
        super('MistralNotesDB');
        this.version(1).stores({
            notes: 'path, updatedAt',
            pendingOps: '++id, path, timestamp'
        });
    }
}

export const db = new NotesDatabase();
