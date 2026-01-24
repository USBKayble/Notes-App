import type { Metadata } from "next";
import { Outfit, Roboto_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/hooks/useSettings";

const outfit = Outfit({
  subsets: ["latin"],
  variable: '--font-outfit',
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: '--font-roboto-mono',
});

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  variable: '--font-pixel',
});

export const metadata: Metadata = {
  title: "Mistral Notes",
  description: "AI-Accelerated Note Taking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${robotoMono.variable} ${pixelifySans.variable} font-sans bg-background text-foreground antialiased selection:bg-primary/30 selection:text-white`}>
        <SettingsProvider>
          <main className="min-h-screen relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_50%_120%,rgba(120,50,255,0.1),rgba(0,0,0,0)_50%)]" />
            <div className="fixed inset-0 z-[-1] bg-[radial-gradient(circle_at_0%_0%,rgba(50,200,255,0.05),rgba(0,0,0,0)_40%)]" />
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  );
}
