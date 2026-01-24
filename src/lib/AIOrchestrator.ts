import { AppSettings } from "@/hooks/useSettings";
import {
    transcriptionChain,
    mediaUnderstanding,
    organizeContent,
    summarizeHighlight,
    synthesizeNote,
    applyGrammarAndSpelling
} from "./mistral";

export interface AIProcessResult {
    content: string;
    isSynthesis: boolean;
    mediaReff?: string;
}

/**
 * Global Auto-Processing Engine
 * Sequentially applies all features set to "apply"
 */
export const autoProcessContent = async (content: string, settings: AppSettings): Promise<string> => {
    const { aiFeatures } = settings;
    let currentText = content;

    // 1. Grammar & Spelling (Auto-Process)
    // The user requested "Grammar" and "Transcription Refinement" to be auto.
    // applyGrammarAndSpelling handles general cleanup/correction which covers both cases effectively.
    if (aiFeatures.grammar.state === 'apply') {
        currentText = await applyGrammarAndSpelling(currentText, settings);
    }

    // Note: Organization and Summarization are now Manual Triggers only.
    // They are not called here to prevent constant re-structuring while typing.

    return currentText;
};

export const processDroppedFile = async (
    file: File,
    currentContent: string,
    settings: AppSettings
): Promise<AIProcessResult> => {
    const { aiFeatures } = settings;
    let processedText = "";
    let isSynthesis = false;
    const mediaReff = file.name;

    // 1. Identify File Type & Route
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        // Audio/Video -> Transcription Chain
        processedText = await transcriptionChain(file, settings);
    } else if (file.type.startsWith('image/')) {
        // Image -> Media/OCR Pipeline
        processedText = await mediaUnderstanding(file, settings) || "";
    } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        // Text/Markdown -> Just read it
        processedText = await file.text();
    }

    if (!processedText) return { content: currentContent, isSynthesis: false };

    // 2. Organization (Subject Grouping)
    if (aiFeatures.organization.state !== "off") {
        processedText = (await organizeContent(processedText, settings)) as string;
    }

    // 3. Summarization (Optional)
    if (aiFeatures.summarization.state !== "off") {
        processedText = await summarizeHighlight(processedText, settings);
    }

    // 4. Scaffolding vs Synthesis
    const isNoteEmpty = !currentContent || currentContent.trim() === "" || currentContent.includes("Start typing...");

    const finalContent = processedText as string;

    if (isNoteEmpty) {
        // Scaffolding: Use processed text as the note foundation
        return { content: finalContent, isSynthesis: false, mediaReff };
    } else {
        // Synthesis: Merge into existing note
        const merged = await synthesizeNote(currentContent, finalContent, mediaReff, settings);
        return { content: merged, isSynthesis: true, mediaReff };
    }
};

