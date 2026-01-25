
import matter from 'gray-matter';

// Simulate EditorPane logic
function simulateCycle(initialFileContent: string) {
    console.log("--- Start Cycle ---");
    const currentFileContent = initialFileContent;
    let metadata: any = {};
    let body = "";

    // 1. AppShell loads file
    console.log(`[1] Loaded: ${JSON.stringify(currentFileContent)}`);

    // 2. EditorPane useEffect parse
    const parsed = matter(currentFileContent);
    metadata = parsed.data;
    const newBody = parsed.content;
    console.log(`[2] Parsed Body: ${JSON.stringify(newBody)}`);

    if (newBody !== body) {
        body = newBody;
    }

    // 3. Milkdown receives body. 
    // Hypothesis: Milkdown trims or normalizes content.
    // Let's assume Milkdown removes leading newline if present?
    // Or adds one at end?
    // CommonMark often requires newline at end of file.
    let milkdownOutput = body;
    
    // Simulate Milkdown normalization (e.g. trim) 
    // milkdownOutput = milkdownOutput.trim(); 
    // IF we don't know what Milkdown does, let's just assume it passes it back "as is" first
    // BUT usually editors ensure a trailing newline.
    if (!milkdownOutput.endsWith('\n')) {
        milkdownOutput += '\n';
    }
    
    console.log(`[3] Milkdown Output: ${JSON.stringify(milkdownOutput)}`);

    // 4. EditorPane handleChange
    const newFileContent = matter.stringify(milkdownOutput, metadata);
    console.log(`[4] New File Content: ${JSON.stringify(newFileContent)}`);

    if (newFileContent !== currentFileContent) {
        console.log("!!! CHANGE DETECTED !!!");
        console.log(`Diff: 
Old: ${JSON.stringify(currentFileContent)}
New: ${JSON.stringify(newFileContent)}`);
        return newFileContent;
    } else {
        console.log("No change.");
        return null;
    }
}

// Test case 1: Simple content
const c1 = simulateCycle(`---\ntitle: Hello\n---\n\nContent`);

// If c1 changed, feed it back
if (c1) {
    simulateCycle(c1);
}
