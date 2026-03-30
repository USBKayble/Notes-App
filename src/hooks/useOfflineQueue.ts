"use client";

import { useEffect, useState, useCallback } from "react";
import { queueStore, QueueItem } from "@/lib/queue-store";
import { saveFileContent, getFileContent } from "@/lib/github";
import { useSession } from "next-auth/react";
import { useSettings } from "@/hooks/useSettings";
import { transcribeAndCleanup } from "@/lib/mistral";

export function useOfflineQueue() {
    const { data: session } = useSession();
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
        const token = session?.accessToken;
        // Don't need mistral key check as it is global now
        if (!isOnline || isProcessing || !token) return;

        try {
            setIsProcessing(true);
            const items = await queueStore.getPendingItems();
            const removePromises: Promise<void>[] = [];

            for (const item of items) {
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
                            const { jobType, audioBlob, targetPath } = item.payload;

                            if (jobType === 'TRANSCRIBE_AND_CLEANUP' && audioBlob) {
                                const text = await transcribeAndCleanup(audioBlob, undefined, settings?.aiFeatures?.transcription?.model);

                                if (text && targetPath && settings?.githubRepo && token) {
                                    const [owner, repo] = settings.githubRepo.split('/');
                                    if (owner && repo) {
                                        const currentContent = await getFileContent(token, owner, repo, targetPath);
                                        const newContent = currentContent ? `${currentContent}\n\n${text}` : text;
                                        await saveFileContent(token, owner, repo, targetPath, newContent);
                                    }
                                }
                            }
                            break;
                        }
                    }
                    removePromises.push(
                        queueStore.remove(item.id).catch(error => {
                            console.error(`Failed to remove item ${item.id}`, error);
                        })
                    );
                } catch (error) {
                    console.error(`Failed to process item ${item.id}`, error);
                    // For now, mark as failed. In future, implement retry with backoff.
                    await queueStore.updateStatus(item.id, 'FAILED');
                }
            }

            await Promise.all(removePromises);
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
