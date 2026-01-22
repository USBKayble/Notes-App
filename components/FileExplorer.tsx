"use client";

import React, { useState } from "react";
import { FileNode } from "@/lib/types";
import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileExplorerProps {
    data: FileNode[];
    onSelect: (path: string) => void;
    selectedPath?: string;
    className?: string;
}

const FileItem = ({ node, onSelect, selectedPath, depth = 0 }: { node: FileNode; onSelect: (path: string) => void; selectedPath?: string; depth?: number }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSelected = selectedPath === node.path;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === "dir") {
            setIsOpen(!isOpen);
        } else {
            onSelect(node.path);
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                style={{ paddingLeft: `${depth * 12 + 12}px` }}
                className={cn(
                    "flex cursor-pointer items-center py-1.5 pr-2 text-sm transition-colors hover:bg-muted/50",
                    isSelected && "bg-muted text-primary font-medium"
                )}
            >
                <span className="mr-2 h-4 w-4 text-muted-foreground">
                    {node.type === "dir" ? (
                        isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    ) : (
                        <File size={14} />
                    )}
                </span>
                <span className="truncate">{node.name}</span>
            </div>
            {isOpen && node.children && (
                <div className="border-l border-muted/20 ml-4">
                    {node.children.map((child) => (
                        <FileItem
                            key={child.path}
                            node={child}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export function FileExplorer({ data, onSelect, selectedPath, className }: FileExplorerProps) {
    return (
        <div className={cn("h-full overflow-y-auto py-2", className)}>
            {data.map((node) => (
                <FileItem key={node.path} node={node} onSelect={onSelect} selectedPath={selectedPath} />
            ))}
            {data.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                    No files found
                </div>
            )}
        </div>
    );
}
