import { db } from "./db";

export async function saveNoteWithSync(path: string, content: string) {
    // 1. Save to Local DB (Optimistic)
    await db.notes.put({
        path,
        content,
        updatedAt: Date.now(),
        syncStatus: "dirty"
    });

    // 2. Add to Pending Queue
    await db.pendingOps.add({
        type: "save",
        path,
        content,
        timestamp: Date.now()
    });

    // 3. Trigger Sync (Fire and Forget)
    processQueue();
}

export async function processQueue() {
    if (!navigator.onLine) return; // Wait for online

    const ops = await db.pendingOps.toArray();

    for (const op of ops) {
        try {
            if (op.type === "save") {
                await fetch("/api/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        path: op.path,
                        content: op.content,
                        message: "Sync from Offline"
                    }),
                });
            }

            // If success, remove from queue and mark local note as synced
            await db.pendingOps.delete(op.id!);
            await db.notes.update(op.path, { syncStatus: "synced" });

        } catch (error) {
            console.error("Sync failed for op:", op, error);
            // Keep in queue, maybe add retry count logic later
        }
    }
}

// Global listener for online event to trigger processing
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        console.log("Online! Processing queue...");
        processQueue();
    });
}
