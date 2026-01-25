
const matter = require('gray-matter');

const original = `---
title: Test Note
date: 2023-10-27
---

# Hello World

This is a test.
`;

const parsed = matter(original);
console.log("Parsed keys:", Object.keys(parsed));
console.log("Raw Frontmatter:", parsed.matter);

const reconstructedFromRaw = `---${parsed.matter}\n---\n${parsed.content}`;

console.log("Original === ReconstructedFromRaw ?", original === reconstructedFromRaw);
if (original !== reconstructedFromRaw) {
    console.log("Mismatch details:");
    console.log("Original:     ", JSON.stringify(original));
    console.log("Reconstructed:", JSON.stringify(reconstructedFromRaw));
} else {
    console.log("MATCH CONFIRMED!");
}
