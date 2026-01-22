"use client";

import { useRouter } from "next/navigation";
import { FileExplorer } from "./FileExplorer";
import { FileNode } from "@/lib/types";

export function RedirectToNote({ tree }: { tree: FileNode[] }) {
    const router = useRouter();

    const handleSelect = (path: string) => {
        // Navigate to /note/[path]
        router.push(`/note/${path}`);
    };

    return <FileExplorer data={tree} onSelect={handleSelect} />;
}
