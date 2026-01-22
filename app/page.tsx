import Link from "next/link";
import { getRepoTree } from "@/lib/github";
import { buildFileTree } from "@/lib/file-tree";
import { RedirectToNote } from "@/components/RedirectToNote";
import { getConfig } from "@/lib/session";
import { redirect } from "next/navigation";

// We want this page to be dynamic to fetch latest tree
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const config = await getConfig();
  if (!config) {
    redirect("/setup");
  }

  const treeItems = await getRepoTree(true);
  const fileTree = buildFileTree(treeItems);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar Area - usually we put sidebar in layout, but here it's the main view for now */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold tracking-tight">Mistral Notes</h2>
          <Link href="/setup" className="text-xs text-muted-foreground hover:text-foreground">Config</Link>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {/* We need a client component wrapper to handle router.push */}
          <RedirectToNote tree={fileTree} />
        </div>
      </aside>

      {/* Main Content Area - Placeholder or Recent Notes */}
      <main className="flex-1 p-8 flex flex-col items-center justify-center text-muted-foreground">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">👋</div>
          <h3 className="text-lg font-medium text-foreground">Welcome to Mistral Notes</h3>
          <p>You are connected to <strong>{config.github.owner}/{config.github.repo}</strong>.</p>
          <p>Select a note from the sidebar to start editing or asking questions.</p>
        </div>
      </main>
    </div>
  );
}
