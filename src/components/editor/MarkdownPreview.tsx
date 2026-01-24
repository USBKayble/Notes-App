import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
    content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
    return (
        <div className="h-full w-full overflow-y-auto p-8 custom-scrollbar">
            <div className="prose prose-invert prose-lg max-w-none 
                prose-headings:text-white prose-p:text-gray-300 prose-a:text-primary 
                prose-code:text-primary prose-pre:bg-black/30 prose-pre:backdrop-blur-sm
                prose-blockquote:border-l-primary prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                prose-img:rounded-xl prose-img:shadow-lg prose-hr:border-white/10"
            >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    );
}
