"use client";

import React, { useEffect, useRef } from 'react';
import { Milkdown, useEditor, MilkdownProvider } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { Ctx } from '@milkdown/ctx';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { math } from '@milkdown/plugin-math';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { clipboard } from '@milkdown/plugin-clipboard';
import { replaceAll } from '@milkdown/utils';
import 'katex/dist/katex.min.css';

interface MilkdownEditorProps {
    value: string;
    onChange?: (markdown: string) => void;
    onFilePaste?: (file: File) => void;
    readOnly?: boolean;
}

const MilkdownEditorContent: React.FC<MilkdownEditorProps> = ({ value, onChange, onFilePaste, readOnly }) => {
    // We need a ref to track if the update comes from outside or inside to avoid loops
    const lastEmittedValue = useRef(value);
    const editorCtx = useRef<Ctx | null>(null);
    const rootRef = useRef<HTMLElement | null>(null);

    // Handle paste events
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (readOnly || !onFilePaste) return;
            
            const items = e.clipboardData?.items;
            if (!items) return;

            let handled = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        onFilePaste(file);
                        handled = true;
                    }
                }
            }
            
            if (handled) {
                e.preventDefault();
            }
        };

        const root = rootRef.current;
        if (root) {
            root.addEventListener('paste', handlePaste);
        }
        return () => {
            if (root) {
                root.removeEventListener('paste', handlePaste);
            }
        };
    }, [onFilePaste, readOnly]);

    useEditor((root) => {
        rootRef.current = root;
        return Editor.make()
            .config((ctx) => {
                ctx.set(rootCtx, root);
                ctx.set(defaultValueCtx, value);
                editorCtx.current = ctx;

                // Set listener for content changes
                ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
                    if (onChange && markdown !== prevMarkdown && !readOnly) {
                        // We are about to emit this value, so we should expect it back.
                        lastEmittedValue.current = markdown;
                        onChange(markdown);
                    }
                });
            })
            .config(nord)
            .use(commonmark)
            .use(gfm)
            .use(math)
            .use(history)
            .use(clipboard)
            .use(listener);
    }, []); // Empty dependency array: Init ONCE

    // Handle ReadOnly Toggle via DOM
    useEffect(() => {
        if (!rootRef.current) return;
        // Milkdown renders a div with class .editor inside the root
        const editorEl = rootRef.current.querySelector('.editor');
        if (editorEl) {
            editorEl.setAttribute('contenteditable', readOnly ? 'false' : 'true');
        }
    }, [readOnly]);

    // Handle external updates
    useEffect(() => {
        if (!editorCtx.current) return;

        // If the value passed in matches what we last emitted, it's an echo from the parent state update.
        // We do NOT want to re-parse and replace the editor content, as that kills cursor position and performance.
        if (value === lastEmittedValue.current) return;

        try {
            // Update our tracker to the new external value
            lastEmittedValue.current = value;
            replaceAll(value)(editorCtx.current);
        } catch (error) {
            console.error("Failed to update editor content:", error);
        }
    }, [value]);

    return <Milkdown />;
};

export default function MilkdownEditor(props: MilkdownEditorProps) {
    return (
        <MilkdownProvider>
            <div className="h-full w-full cosmic-editor-wrapper prose prose-invert max-w-none">
                <MilkdownEditorContent {...props} />
                <style jsx global>{`
                /* Milkdown Overrides for Cosmic Theme */
                .milkdown .editor {
                    padding: 2rem;
                    outline: none;
                    min-height: 100%;
                    font-family: var(--font-editor, inherit);
                }

                /* Aggressive override for Tailwind Typography (prose) */
                .milkdown, 
                .milkdown .prose,
                .prose {
                    color: #ffffff !important;
                }

                .milkdown p, 
                .milkdown h1, 
                .milkdown h2, 
                .milkdown h3, 
                .milkdown h4, 
                .milkdown h5, 
                .milkdown h6,
                .milkdown li,
                .milkdown span,
                .milkdown div,
                .milkdown strong,
                .milkdown b,
                .milkdown em,
                .milkdown i,
                .milkdown blockquote,
                .milkdown code,
                .milkdown th,
                .milkdown td,
                .milkdown a {
                    color: #ffffff !important;
                }

                /* Math Styling */
                .katex {
                    font-size: 1.1em;
                    color: #ffffff !important;
                }

                /* Dark Scrollbar Styling */
                ::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                    background: #0f1115; /* Cosmic black/dark BG */
                }
                ::-webkit-scrollbar-thumb {
                    background: #364153; /* Dark blue/grey thumb */
                    border-radius: 5px;
                    border: 2px solid #0f1115; /* Padding effect */
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                }
                ::-webkit-scrollbar-track {
                    background: #0f1115;
                }
                `}</style>
            </div>
        </MilkdownProvider>
    );
}
