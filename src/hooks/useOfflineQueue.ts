"use client";

import { useEffect, useState, useCallback } from "react";
import { queueStore, QueueItem } from "@/lib/queue-store";
import { saveFileContent } from "@/lib/github";
import { useSettings } from "@/hooks/useSettings";

export function useOfflineQueue() {
    const { settings } = useSettings();
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
        if (!isOnline || isProcessing || !settings.githubApiKey || !settings.mistralApiKey) return;

        try {
            setIsProcessing(true);
            const items = await queueStore.getPendingItems();

            for (const item of items) {
                if (!navigator.onLine) break; // Stop if we go offline mid-process

                await queueStore.updateStatus(item.id, 'PROCESSING');

                try {
                    switch (item.type) {
                        case 'FILE_SAVE': {
                            const { owner, repo, path, content, sha } = item.payload;
                            await saveFileContent(settings.githubApiKey, owner, repo, path, content, sha);
                            break;
                        }
                        case 'AI_JOB': {
                            console.log("Processing AI Job:", item.payload);
                            // TODO: Implement AI pipeline execution here
                            // For now we just simulate success or implement basic transcription if needed
                            // based on sub-type
                            break;
                        }
                    }
                    await queueStore.remove(item.id);
                } catch (error) {
                    console.error(`Failed to process item ${item.id}`, error);
                    // For now, mark as failed. In future, implement retry with backoff.
                    await queueStore.updateStatus(item.id, 'FAILED');
                }
            }
        } finally {
            setIsProcessing(false);
            updateQueueLength();
        }
    }, [isOnline, isProcessing, settings.githubApiKey, settings.mistralApiKey, updateQueueLength]);

    // Auto-process when coming online
    useEffect(() => {
        if (isOnline && queueLength > 0) {
            processQueue();
        }
    }, [isOnline, queueLength, processQueue]);

    const addToQueue = async (type: QueueItem['type'], payload: any) => {
        await queueStore.enqueue({ type, payload });
        await updateQueueLength();
    };

    return {
        isOnline,
        queueLength,
        addToQueue,
        manuallyProcessQueue: processQueue
    };
}
