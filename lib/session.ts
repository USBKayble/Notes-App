import { cookies } from "next/headers";

export interface AppConfig {
    github: {
        owner: string;
        repo: string;
        token: string;
    };
    mistral: {
        apiKey: string;
    };
}

export async function getConfig(): Promise<AppConfig | null> {
    const cookieStore = await cookies();
    const config = cookieStore.get("lines_config");

    if (!config) return null;

    try {
        return JSON.parse(config.value);
    } catch {
        return null;
    }
}

export async function setConfig(config: AppConfig) {
    const cookieStore = await cookies();
    // Set cookie with valid implementation
    cookieStore.set("lines_config", JSON.stringify(config), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });
}
