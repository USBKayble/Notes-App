
const matter = require('gray-matter');

const content = `# Welcome to Mistral Notes

## Formatting Guide
- **Bold**: **text** or Ctrl+B
`;

const parsed = matter(content);
const stringified = matter.stringify(parsed.content, parsed.data);

console.log("Original length:", content.length);
console.log("Stringified length:", stringified.length);
console.log("Match:", content === stringified);
console.log("Parsed content:", JSON.stringify(parsed.content));
console.log("Stringified:", JSON.stringify(stringified));
