"use client";

import { useSettings } from "@/hooks/useSettings";
import { useEffect } from "react";

export function FontLoader() {
    const { settings } = useSettings();

    useEffect(() => {
        const fontName = settings.editorFont;
        if (!fontName) return;

        // Skip loading for system fonts or if already loaded by Next.js (though Next.js fonts have hashed names usually)
        // We'll just try to load it from Google Fonts to be safe and simple

        const linkId = 'dynamic-font-loader';
        let link = document.getElementById(linkId) as HTMLLinkElement;

        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }

        const formattedFont = fontName.replace(/\s+/g, '+');
        link.href = `https://fonts.googleapis.com/css2?family=${formattedFont}:wght@400;500;600;700&display=swap`;

        // Update the global CSS variable for the sans-serif font stack
        // This overrides the Tailwind default set in globals.css
        document.documentElement.style.setProperty('--font-sans', `'${fontName}', sans-serif`);

        // Disable overrides by forcing all other font variables to match the selected font
        const fontString = `'${fontName}', sans-serif`;
        document.documentElement.style.setProperty('--font-outfit', fontString);
        document.documentElement.style.setProperty('--font-roboto-mono', fontString);
        document.documentElement.style.setProperty('--font-pixel', fontString);
        document.documentElement.style.setProperty('--font-mono', fontString);

        // Restore --font-editor for Milkdown
        document.documentElement.style.setProperty('--font-editor', fontString);

        // Also set it strictly on the body to ensure it cascades if something else is more specific
        document.body.style.fontFamily = fontString;

    }, [settings.editorFont]);

    return null;
}
