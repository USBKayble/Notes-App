export async function processFile(file: File): Promise<string> {
    // 1. Text files
    if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
        return await file.text();
    }

    // 2. Images (Mistral Vision can handle base64, but here we might preserve as image data)
    if (file.type.startsWith("image/")) {
        // For now, we return a instruction to use Vision
        // In a real app, we converts to base64 data url
        return "[Image File - Needs to be sent as image_url in message]";
    }

    // 3. Office Documents (PPTX, DOCX)
    // We would use libraries like 'mammoth' or 'officeparser' here.
    // For this v1, we assume we might convert them on server or use an external service.
    if (file.name.endsWith(".pptx")) {
        return "[PPTX file detected - Conversion service required]";
    }

    return "";
}

export function isImage(path: string) {
    return path.match(/\.(jpeg|jpg|gif|png)$/) != null;
}
