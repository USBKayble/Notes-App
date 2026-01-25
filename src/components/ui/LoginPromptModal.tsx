"use client";

import React from "react";
import { signIn, useSession } from "next-auth/react";
import { Github, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPromptModal() {
    const { data: session, status } = useSession();
    const [showWhySignIn, setShowWhySignIn] = React.useState(false);

    // Don't show if loading or if session exists
    if (status === "loading" || session) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="glass-panel w-full max-w-sm p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10">
                    <Github size={32} className="text-white" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Welcome to Mistral Notes</h2>
                    <p className="text-sm text-gray-400">
                        Please sign in with GitHub to access your notes and sync changes.
                    </p>

                    <button
                        onClick={() => setShowWhySignIn(!showWhySignIn)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors focus:outline-none focus:underline"
                    >
                        Why sign in?
                    </button>

                    <AnimatePresence>
                        {showWhySignIn && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20
                                }}
                                className="overflow-hidden"
                            >
                                <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10 text-left">
                                    <motion.p
                                        initial={{ backgroundPosition: "150% 0%" }}
                                        animate={{ backgroundPosition: "0% 0%" }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 20
                                        }}
                                        className="text-xs font-medium leading-relaxed bg-gradient-to-r from-gray-400 via-gray-100 to-gray-400 bg-[length:200%_auto] bg-clip-text text-transparent"
                                    >
                                        We use GitHub to safely store your notes in the cloud. This ensures your data isn&apos;t lost and syncs across devices.
                                    </motion.p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <button
                    onClick={() => signIn("github")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Github size={18} />
                    Sign in with GitHub
                </button>

                <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#18181b] px-2 text-muted-foreground">Or</span>
                    </div>
                </div>

                <button
                    onClick={() => signIn("local-guest")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 border border-white/10 transition-all"
                >
                    <HardDrive size={18} />
                    Sign in as Guest (Local)
                </button>
            </div>
        </div>
    );
}
