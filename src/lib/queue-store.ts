
const DB_NAME = "MistralNotesDB";
const STORE_NAME = "offlineQueue";
const DB_VERSION = 1;

export interface QueueItem {
    id: string;
    type: 'FILE_SAVE' | 'AI_JOB';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    status: 'PENDING' | 'PROCESSING' | 'FAILED';
    createdAt: number;
    retryCount: number;
}

class QueueStore {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                    store.createIndex("status", "status", { unique: false });
                    store.createIndex("createdAt", "createdAt", { unique: false });
                }
            };
        });
    }

    async enqueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'retryCount'>): Promise<string> {
        await this.init();
        const fullItem: QueueItem = {
            ...item,
            id: crypto.randomUUID(),
            status: 'PENDING',
            createdAt: Date.now(),
            retryCount: 0
        };

        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.add(fullItem);

            request.onsuccess = () => resolve(fullItem.id);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingItems(): Promise<QueueItem[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const tx = this.db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("status");
            const request = index.getAll("PENDING");

            request.onsuccess = () => {
                const items = request.result as QueueItem[];
                // Sort by creation time to ensure FIFO
                resolve(items.sort((a, b) => a.createdAt - b.createdAt));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async updateStatus(id: string, status: QueueItem['status'], updates?: Partial<QueueItem>): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            // First get the item
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const item = getReq.result as QueueItem;
                if (!item) {
                    // Item might have been removed or handled
                    resolve();
                    return;
                }

                const updatedItem = { ...item, status, ...updates };
                const putReq = store.put(updatedItem);

                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };

            getReq.onerror = () => reject(getReq.error);
        });
    }

    async remove(id: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const queueStore = new QueueStore();
