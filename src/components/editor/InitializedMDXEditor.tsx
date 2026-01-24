"use client";

import type { ForwardedRef } from 'react'
import {
    MDXEditor,
    MDXEditorMethods,
    headingsPlugin,
    listsPlugin,
    quotePlugin,
    thematicBreakPlugin,
    markdownShortcutPlugin,
    linkPlugin,
    linkDialogPlugin,
    toolbarPlugin,
    UndoRedo,
    BoldItalicUnderlineToggles,
    BlockTypeSelect,
    ListsToggle,
    CreateLink,
    InsertThematicBreak,
    imagePlugin,
    frontmatterPlugin,
    codeBlockPlugin,
    codeMirrorPlugin,
    mathPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import 'katex/dist/katex.min.css'
import { useSettings } from "@/hooks/useSettings";

// We need to style the editor to match our "Cosmic Glass" theme.
// We'll inject some custom CSS via the className or a style tag,
// or rely on a wrapper div in the parent.

interface EditorProps {
    value: string;
    editorRef: ForwardedRef<MDXEditorMethods> | null;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    imageUploadHandler?: (image: File) => Promise<string>;
}

export default function InitializedMDXEditor({
    editorRef,
    value,
    onChange,
    readOnly = false,
    imageUploadHandler
}: EditorProps) {
    const { settings } = useSettings();

    // Determine font family based on settings
    const getFontFamily = () => {
        switch (settings.editorFont) {
            case 'pixel': return "var(--font-pixel), 'Pixelify Sans', monospace";
            case 'mono': return "var(--font-roboto-mono), 'Fira Code', monospace";
            default: return "var(--font-outfit), system-ui, sans-serif";
        }
    };

    const fontFamily = getFontFamily();
    const fontSize = settings.editorFont === 'pixel' ? '20px' : '16px';

    return (
        <div
            className="h-full w-full cosmic-editor-wrapper"
            style={{
                '--font-editor': fontFamily,
                '--text-size-editor': fontSize,
            } as React.CSSProperties}
        >
            <MDXEditor
                ref={editorRef}
                markdown={value}
                onChange={onChange}
                readOnly={readOnly}
                contentEditableClassName="prose prose-invert max-w-none h-full focus:outline-none px-8 py-4 cosmic-editor-content"
                plugins={[
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    linkPlugin(),
                    linkDialogPlugin(),
                    markdownShortcutPlugin(),
                    imagePlugin({ imageUploadHandler }),
                    frontmatterPlugin(),
                    codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
                    codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', css: 'CSS', txt: 'text', tsx: 'TypeScript', python: 'Python' } }),
                    mathPlugin(),
                    toolbarPlugin({
                        toolbarContents: () => (
                            <>
                                {' '}
                                <UndoRedo />
                                <BoldItalicUnderlineToggles />
                                <BlockTypeSelect />
                                <ListsToggle />
                                <CreateLink />
                                <InsertThematicBreak />
                            </>
                        )
                    })
                ]}
            />
            <style jsx global>{`
        .cosmic-editor-wrapper {
            /* Override MDXEditor standard variables */
            --mdx-base-color: #e0e0e0;
            --mdx-bg-color: transparent;
            --mdx-text-color: #e0e0e0;
            
            /* Toolbar Variables */
            --mdx-toolbar-bg-color: #000000;
            --mdx-toolbar-text-color: #e2e2e2;
            --mdx-icon-color: #e2e2e2;
            --mdx-icon-active-color: #ffffff;
            --mdx-icon-hover-color: #ffffff;
            
            /* Font settings */
            --mdx-editor-font-family: var(--font-editor);
            --mdx-editor-font-size: var(--text-size-editor);
        }

        /* Force Toolbar Styling - targeting the specific class structure of MDXEditor */
        .cosmic-editor-wrapper [role="toolbar"] {
            background-color: #000000 !important;
            border-bottom: 1px solid #333 !important;
            color: #e2e2e2 !important;
        }
        
        /* Toolbar Buttons */
        .cosmic-editor-wrapper [role="toolbar"] button {
            color: #e2e2e2 !important;
        }
        
        .cosmic-editor-wrapper [role="toolbar"] button svg {
            color: #e2e2e2 !important;
            fill: currentColor;
        }

        .cosmic-editor-wrapper [role="toolbar"] button:hover, 
        .cosmic-editor-wrapper [role="toolbar"] button[data-state="on"] {
            background-color: #333333 !important;
            color: #ffffff !important;
        }

        /* Dropdowns/Selects */
        .cosmic-editor-wrapper [role="toolbar"] [role="combobox"],
        .cosmic-editor-wrapper [role="toolbar"] select {
            background-color: #111111 !important;
            color: #e2e2e2 !important;
            border-color: #333 !important;
        }
        
        .cosmic-editor-wrapper [role="toolbar"] [role="combobox"]:hover {
             background-color: #222222 !important;
        }
        
        /* Dropdown Content */
        div[role="listbox"] {
            background-color: #111111 !important;
            border: 1px solid #333 !important;
            color: #e0e0e0 !important;
        }

        /* Editor Content Area */
        .cosmic-editor-content {
            font-family: var(--font-editor);
            font-size: var(--text-size-editor);
            line-height: 1.6;
            color: #e0e0e0;
        }

        /* Force overrides for Tailwind Typography specificity */
        .cosmic-editor-content p,
        .cosmic-editor-content li,
        .cosmic-editor-content span,
        .cosmic-editor-content strong,
        .cosmic-editor-content em {
            color: #e0e0e0 !important;
        }

        /* Headings */
        .cosmic-editor-content h1, 
        .cosmic-editor-content h2, 
        .cosmic-editor-content h3,
        .cosmic-editor-content h4,
        .cosmic-editor-content h5,
        .cosmic-editor-content h6 {
            color: #ffffff !important;
            font-weight: 600;
        }

        /* Links */
        .cosmic-editor-content a {
            color: #8ab4f8; /* Light blue */
            text-decoration: none;
        }
        .cosmic-editor-content a:hover {
            text-decoration: underline;
        }
        
        /* Lists */
        .cosmic-editor-content ul {
            list-style-type: disc;
            padding-left: 1.5em;
        }
        
        /* Blockquotes */
        .cosmic-editor-content blockquote {
            border-left: 4px solid #555;
            padding-left: 1em;
            color: #adadad;
            font-style: italic;
        }
      `}</style>
        </div>
    )
}
