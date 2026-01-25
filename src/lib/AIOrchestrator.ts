import { AppSettings } from "@/hooks/useSettings";
import {
    transcriptionChain,
    mediaUnderstanding,
    organizeContent,
    summarizeHighlight,
    synthesizeNote,
    applyGrammarAndSpelling
} from "./mistral";
import { uploadAsset } from "./github";

export interface AIProcessResult {
    content: string;
    isSynthesis: boolean;
    mediaReff?: string;
}

/**
 * Removes large data URLs and other binary-like blobs that might slow down AI processing.
 */
const cleanContentForAI = (content: string): string => {
    // Replace data URLs with a placeholder
    return content.replace(/data:[^;]+;base64,[a-zA-Z0-9+/=]+/g, "[Binary Data Blob]");
};

/**
 * Global Auto-Processing Engine
 * Sequentially applies all features set to "apply"
 */
export const autoProcessContent = async (content: string, settings: AppSettings): Promise<string> => {
    const { aiFeatures } = settings;

    // If content has large blobs, clean it ONLY for the AI agents to avoid timeouts/overload.
    let textToProcess = content;
    const hasBlobs = /data:[^;]+;base64,/.test(content);

    if (hasBlobs) {
        console.warn("Content contains data URLs, cleaning for AI processing...");
        textToProcess = cleanContentForAI(content);
    }

    const start = Date.now();

    // 1. Grammar & Spelling (Auto-Process)
    if (aiFeatures.grammar.state === 'apply' || aiFeatures.grammar.state === 'suggest') {
        textToProcess = await applyGrammarAndSpelling(textToProcess, settings);
    }

    // 2. Organization (Subject Grouping & Contextual Move)
    if (aiFeatures.organization.state === 'apply' || aiFeatures.organization.state === 'suggest') {
        textToProcess = (await organizeContent(textToProcess, settings)) as string;
    }

    const end = Date.now();
    console.log(`AI Auto-processing took ${end - start}ms`);

    // If we started with blobs, we MUST NOT return textToProcess because the blobs are now "[Binary Data Blob]".
    // In this case, we return the original content to avoid data loss.
    // The user should ideally use the drop/paste handler which converts blobs to references.
    if (hasBlobs) {
        console.warn("Blobs detected: Returning original content to prevent data loss. AI processing results discarded for this save.");
        return content;
    }

    return textToProcess;
};

export const processDroppedFile = async (
    file: File,
    currentContent: string,
    settings: AppSettings,
    githubInfo?: { token: string; owner: string; repo: string }
): Promise<AIProcessResult> => {
    const { aiFeatures } = settings;
    const start = Date.now();
    let processedText = "";
    let assetPath = "";

    // 1. Upload Media-Link First (If GitHub Configured)
    // We do this early so we have a reference path for the AI to "know" about.
    if (githubInfo && (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
        const uploadStart = Date.now();
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + "_" +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');

        const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const path = `assets/media/${timestamp}_${safeName}`;

        console.log(`Uploading asset to ${path}...`);
        try {
            const uploadedPath = await uploadAsset(githubInfo.token, githubInfo.owner, githubInfo.repo, path, file);
            console.log(`Asset upload took ${Date.now() - uploadStart}ms`);
            if (uploadedPath) {
                assetPath = uploadedPath;
                console.log("Asset uploaded successfully:", assetPath);
            }
        } catch (e) {
            console.error("Failed to upload asset:", e);
            // We continue processing, but assetPath will be empty, so no link will be generated or it will be a fallback.
        }
    }

    // 2. Extraction (OCR / Transcription / Text Read)
    let mediaInfo: { description: string, image_ref?: string } | null = null;
    let markdownReference = "";

    if (assetPath) {
        // Construct the markdown reference immediately if we have a path
        if (file.type.startsWith('image/')) {
            markdownReference = `![${file.name}](${assetPath})`;
        } else {
            markdownReference = `[📎 ${file.name}](${assetPath})`;
        }
    }

    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        processedText = await transcriptionChain(file, settings);
    } else if (file.type.startsWith('image/')) {
        const mediaStart = Date.now();
        const mediaResult = await mediaUnderstanding(file, settings);
        console.log(`Media understanding took ${Date.now() - mediaStart}ms`);
        if (mediaResult) {
            // If we have an assetPath, we can tell the AI "This analysis is for image at [path]"
            processedText = mediaResult.combined;
            mediaInfo = {
                description: mediaResult.description + "\n\n" + mediaResult.ocrMarkdown,
                image_ref: assetPath // Use the real path
            };
        }
    } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        processedText = await file.text();
    }

    if (!processedText && !assetPath) return { content: currentContent, isSynthesis: false };

    // 3. Grammar (Clean up the new input)
    if (mediaInfo && aiFeatures.grammar.state !== "off") {
        const grammarStart = Date.now();
        mediaInfo.description = await applyGrammarAndSpelling(mediaInfo.description, settings);
        processedText = mediaInfo.description;
        console.log(`Grammar processing took ${Date.now() - grammarStart}ms`);
    } else if (processedText && aiFeatures.grammar.state !== "off") {
        const grammarStart = Date.now();
        processedText = await applyGrammarAndSpelling(processedText, settings);
        console.log(`Grammar processing took ${Date.now() - grammarStart}ms`);
    }

    // 4. Organization (Structure the new input)
    if (processedText && aiFeatures.organization.state !== "off") {
        const orgStart = Date.now();
        const context = mediaInfo?.image_ref
            ? `This content describes image ${mediaInfo.image_ref}`
            : `Associated file: ${markdownReference}`;

        processedText = (await organizeContent(processedText, settings, context)) as string;
        console.log(`Organization took ${Date.now() - orgStart}ms`);
    }

    // 5. Summarization (Optional - on new input)
    if (processedText && aiFeatures.summarization.state !== "off") {
        const summStart = Date.now();
        processedText = await summarizeHighlight(processedText, settings);
        console.log(`Summarization took ${Date.now() - summStart}ms`);
    }

    // Capture the final content block to insert
    const finalNewContent = markdownReference
        ? `${markdownReference}\n\n${processedText}`
        : processedText;

    // 6. Synthesis (Contextual Insertion / Append)
    const isNoteEmpty = !currentContent || currentContent.trim() === "" || currentContent.includes("Start typing...");

    if (isNoteEmpty) {
        console.log(`Total file processing took ${Date.now() - start}ms`);
        return { content: finalNewContent, isSynthesis: false, mediaReff: assetPath || file.name };
    } else {
        const synthStart = Date.now();
        // Synthesis: Merge into existing note
        // Pass the assetPath as the 'mediaReff' so the synthesizer knows what we are talking about
        const merged = await synthesizeNote(currentContent, finalNewContent, assetPath || file.name, settings);
        console.log(`Synthesis took ${Date.now() - synthStart}ms`);
        console.log(`Total file processing took ${Date.now() - start}ms`);
        return { content: merged, isSynthesis: true, mediaReff: assetPath || file.name };
    }
};

