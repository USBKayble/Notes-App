import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { saveFileContent } from '@/lib/github';
import { useOfflineQueue } from './useOfflineQueue';
import { AppSettings } from './useSettings';
import { autoProcessContent } from '@/lib/AIOrchestrator';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveManagerResult {
    saveStatus: SaveStatus;
    lastSaved: Date | null;
    saveError: string | null;
    save: (content: string, filePath: string, settings: AppSettings, checkAbort?: () => boolean) => Promise<string>;
    isLocalSave: boolean;
    isAIProcessing: boolean;
}

export function useSaveManager(): SaveManagerResult {
    const { data: session } = useSession();
    const { isOnline, addToQueue } = useOfflineQueue();
    
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isLocalSave, setIsLocalSave] = useState(false);
    const [isAIProcessing, setIsAIProcessing] = useState(false);

    const save = useCallback(async (content: string, filePath: string, settings: AppSettings, checkAbort?: () => boolean): Promise<string> => {
        if (!filePath || !settings.githubRepo) return content;

        setSaveStatus('saving');
        setSaveError(null);
        let finalContent = content;

        try {
            // 1. AI Processing (Pre-save)
            // Only run if at least one AI feature is in 'apply' state
            const shouldAI = Object.values(settings.aiFeatures).some(f => f.state === 'apply');
            
            if (shouldAI) {
                console.log("Running AI Pre-save processing...");
                setIsAIProcessing(true);
                try {
                    finalContent = await autoProcessContent(content, settings);
                } catch (aiError) {
                    console.error("AI processing failed, continuing with original content", aiError);
                    finalContent = content;
                } finally {
                    setIsAIProcessing(false);
                }
            }

            // 2. Abort Check (Did user type during AI processing?)
            if (checkAbort && checkAbort()) {
                console.log("Save aborted: Content changed during processing.");
                setSaveStatus('idle');
                return content; 
            }

            // 3. Save to Local Storage
            try {
                localStorage.setItem(`local_backup:${filePath}`, finalContent);
                setIsLocalSave(true);
            } catch (e) {
                console.error("Local save failed", e);
            }

            const token = session?.accessToken as string;
            
            // If Guest (no token), we are done.
            if (!token) {
                setSaveStatus('saved');
                setLastSaved(new Date());
                return finalContent;
            }

            const [owner, repo] = settings.githubRepo.split("/");

            // 4. Save to GitHub
            if (isOnline) {
                await saveFileContent(token, owner, repo, filePath, finalContent);
                setIsLocalSave(false); 
                setSaveStatus('saved');
                setLastSaved(new Date());
            } else {
                throw new Error("Offline");
            }

        } catch (e: unknown) {
            console.log("Save failed or offline, queuing...", e);
            
            if (session?.accessToken && settings.githubRepo) {
                const [owner, repo] = settings.githubRepo.split("/");
                await addToQueue('FILE_SAVE', {
                    owner, repo, path: filePath, content: finalContent
                });
                setSaveError((e as Error).message || "Save failed (Queued)");
            } else {
                setSaveError((e as Error).message || "Save failed");
            }
            
            setIsLocalSave(true);
            setSaveStatus('idle'); // Back to idle so it can retry
        }
        
        return finalContent;
    }, [session, isOnline, addToQueue]);

    return {
        saveStatus,
        lastSaved,
        saveError,
        save,
        isLocalSave,
        isAIProcessing
    };
}
