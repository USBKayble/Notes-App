
const matter = require('gray-matter');

const original = `---
title: Test Note
date: 2023-10-27
---

# Hello World

This is a test.
`;

const parsed = matter(original, { excerpt: false });
// gray-matter doesn't have a direct 'date: false' option in the main signature easily for v4 without engines, 
// but let's try to see if just stringifying back works if we treat dates as strings.
// Actually, let's try to see if we can just avoid the re-stringify if the content hasn't changed.
// Or we can try to use the `original` raw content if available.

console.log("Original length:", original.length);
console.log("Reconstructed length:", reconstructed.length);

if (original !== reconstructed) {
    console.log("MISMATCH DETECTED!");
    console.log("--- Original ---");
    console.log(JSON.stringify(original));
    console.log("--- Reconstructed ---");
    console.log(JSON.stringify(reconstructed));
} else {
    console.log("Match!");
}
