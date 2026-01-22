import { getFile, saveFile } from "../lib/github";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Starting GitHub Verification...");

    const OWNER = process.env.GITHUB_OWNER;
    const REPO = process.env.GITHUB_REPO;
    const TOKEN = process.env.GITHUB_TOKEN;

    if (!OWNER || !REPO || !TOKEN) {
        console.error("❌ Missing Environment Variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN");
        console.log("Since the app now uses In-App Setup (Cookies), these scripts require a .env.local file to function.");
        console.log("Please create a .env.local file with these variables just for this script.");
        process.exit(1);
    }

    console.log(`Target: ${OWNER}/${REPO}`);

    const testPath = "verification-test.md";
    const content = `# Verification Note\nCreated at ${new Date().toISOString()}`;

    try {
        console.log("Attempting to write file...");
        const result = await saveFile(testPath, content, "Verification test commit");
        console.log("✅ Write Success!", result.content?.html_url);

        console.log("Attempting to read file...");
        const file = await getFile(testPath);
        if (file) {
            console.log("✅ Read Success!", file.name);
        } else {
            console.error("❌ Read Failed: File not found.");
        }

        console.log("Attempting to fetch repo tree...");
        const { getRepoTree } = require("../lib/github");
        const tree = await getRepoTree(true);
        if (tree && tree.length > 0) {
            console.log(`✅ Tree Fetch Success! Found ${tree.length} items.`);
        } else {
            console.warn("⚠️ Tree Fetch returned empty or failed (check console for error).");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
        process.exit(1);
    }
}

main();
