"use client";

import { useEffect, useState, useCallback } from "react";
import { queueStore, QueueItem } from "@/lib/queue-store";
import { saveFileContent } from "@/lib/github";
import { useSession } from "next-auth/react";

export function useOfflineQueue() {
    const { data: session } = useSession();
    const [isOnline, setIsOnline] = useState(true);
    const [queueLength, setQueueLength] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Initial check and listeners
    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Queue monitoring (simplified polling for now, could be event-driven)
    const updateQueueLength = useCallback(async () => {
        const items = await queueStore.getPendingItems();
        setQueueLength(items.length);
    }, []);

    useEffect(() => {
        updateQueueLength();
        const interval = setInterval(updateQueueLength, 5000);
        return () => clearInterval(interval);
    }, [updateQueueLength]);

    // Processor
    const processQueue = useCallback(async () => {
        const token = session?.accessToken;
        // Don't need mistral key check as it is global now
        if (!isOnline || isProcessing || !token) return;

        try {
            setIsProcessing(true);
            const items = await queueStore.getPendingItems();

            // Group items to process independent tasks concurrently
            // while preserving sequential order for the same resource
            const groups: Record<string, QueueItem[]> = {};

            for (const item of items) {
                let groupKey = item.id; // Default to independent

                if (item.type === 'FILE_SAVE') {
                    const { owner, repo, path } = item.payload;
                    groupKey = `FILE_SAVE:${owner}/${repo}/${path}`;
                }

                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(item);
            }

            const processGroup = async (groupItems: QueueItem[]) => {
                for (const item of groupItems) {
                    if (!navigator.onLine) break; // Stop if we go offline mid-process

                    await queueStore.updateStatus(item.id, 'PROCESSING');

                    try {
                        switch (item.type) {
                            case 'FILE_SAVE': {
                                const { owner, repo, path, content, sha } = item.payload;
                                if (token) {
                                    await saveFileContent(token, owner, repo, path, content, sha);
                                }
                                break;
                            }
                            case 'AI_JOB': {
                                console.log("Processing AI Job:", item.payload);
                                // TODO: Implement AI pipeline execution here
                                break;
                            }
                        }

                        // Remove item on success
                        await queueStore.remove(item.id).catch(error => {
                            console.error(`Failed to remove item ${item.id}`, error);
                        });

                    } catch (error) {
                        console.error(`Failed to process item ${item.id}`, error);
                        // For now, mark as failed.
                        await queueStore.updateStatus(item.id, 'FAILED');

                        // Break out of the group processing to avoid out-of-order execution
                        // for subsequent items targeting the same resource
                        break;
                    }
                }
            };

            // Process all groups concurrently
            await Promise.all(Object.values(groups).map(processGroup));

        } finally {
            setIsProcessing(false);
            updateQueueLength();
        }
    }, [isOnline, isProcessing, session, updateQueueLength]);

    // Auto-process when coming online
    useEffect(() => {
        if (isOnline && queueLength > 0) {
            processQueue();
        }
    }, [isOnline, queueLength, processQueue]);

    const addToQueue = async (type: QueueItem['type'], payload: unknown) => {
        await queueStore.enqueue({ type, payload: payload as never });
        await updateQueueLength();
    };

    return {
        isOnline,
        queueLength,
        addToQueue,
        manuallyProcessQueue: processQueue
    };
}
