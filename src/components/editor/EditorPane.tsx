"use client";

import React, { useRef } from "react";
import Editor, { OnMount, DiffEditor, DiffOnMount } from "@monaco-editor/react";
import { useSettings } from "@/hooks/useSettings";

interface EditorPaneProps {
    value: string;
    originalValue?: string;
    onChange: (value: string | undefined) => void;
    language?: string;
}

export default function EditorPane({ value, originalValue, onChange, language = "markdown" }: EditorPaneProps) {
    const { settings } = useSettings();
    const editorRef = useRef<any>(null);
    const diffEditorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        defineTheme(monaco);
    };

    const handleDiffEditorDidMount: DiffOnMount = (editor, monaco) => {
        diffEditorRef.current = editor;
        defineTheme(monaco);

        // Listen to changes in the modified editor
        const modifiedEditor = editor.getModifiedEditor();
        modifiedEditor.onDidChangeModelContent(() => {
            onChange(modifiedEditor.getValue());
        });
    };

    const defineTheme = (monaco: any) => {
        monaco.editor.defineTheme('glass-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000',
                'editorGutter.background': '#00000000',
                'editorLineNumber.foreground': '#555555',
                'diffEditor.insertedTextBackground': '#22553330',
                'diffEditor.removedTextBackground': '#66222230',
            }
        });
        monaco.editor.setTheme('glass-dark');
    };

    const getFontFamily = () => {
        switch (settings.editorFont) {
            case 'pixel': return "var(--font-pixel), 'Pixelify Sans', monospace";
            case 'mono': return "var(--font-roboto-mono), 'Fira Code', monospace";
            default: return "var(--font-outfit), system-ui, sans-serif";
        }
    };

    const commonOptions = {
        minimap: { enabled: false },
        fontSize: settings.editorFont === 'pixel' ? 20 : 16, // Pixel font needs to be larger
        fontFamily: getFontFamily(),
        fontLigatures: true,
        wordWrap: "on" as const,
        padding: { top: 20, bottom: 20 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "smooth" as const,
        cursorSmoothCaretAnimation: "on" as const,
        formatOnPaste: true,
        formatOnType: true,
        lineNumbers: "on" as const,
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        renderLineHighlight: "none" as const,
    };

    // If originalValue is provided and different (or just provided to force diff mode), use DiffEditor
    const showDiff = originalValue !== undefined && originalValue !== null;

    // Persist model by providing a path
    const editorPath = showDiff ? "diff-editor" : "editor-model.md";

    return (
        <div className="h-full w-full overflow-hidden bg-transparent">
            {showDiff ? (
                <DiffEditor
                    height="100%"
                    language={language}
                    original={originalValue}
                    modified={value}
                    onMount={handleDiffEditorDidMount}
                    theme="glass-dark"
                    options={{
                        ...commonOptions,
                        renderSideBySide: false, // Inline Diff
                        readOnly: false,
                        originalEditable: false,
                        diffWordWrap: "on",
                    }}
                />
            ) : (
                <Editor
                    height="100%"
                    path={editorPath}
                    defaultLanguage={language}
                    defaultValue={value}
                    value={value}
                    onChange={onChange}
                    theme="glass-dark"
                    onMount={handleEditorDidMount}
                    loading={<div className="text-muted-foreground text-sm p-4">Loading Editor...</div>}
                    options={commonOptions}
                />
            )}
        </div>
    );
}
