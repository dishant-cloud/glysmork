"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User, Mail, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AnimatePresence, motion } from 'framer-motion'; // Assuming framer-motion is installed

export default function Header() {
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) {
            try {
                setUsername(JSON.parse(u).username);
            } catch (e) {
                console.error("Failed to parse user data in header");
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('access_token'); // Added back from original
        localStorage.removeItem('refresh_token'); // Added back from original
        window.location.href = '/login';
    };

    return (
        <header className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pointer-events-none">
            <div className="pointer-events-auto">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-black dark:bg-white flex items-center justify-center rounded-none group-hover:rotate-45 transition-transform duration-500">
                        <span className="text-white dark:text-black font-black text-xl tracking-tighter">G</span>
                    </div>
                </Link>
            </div>

            <nav className="pointer-events-auto flex items-center gap-4">
                <AnimatePresence mode="wait">
                    {username ? (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4"
                        >
                            <Link
                                href="/messages?view=friends"
                                title="Friends"
                                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-gray-400 hover:text-purple-400"
                            >
                                <Users size={18} />
                            </Link>
                            <Link
                                href="/messages"
                                title="Messages"
                                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-gray-400 hover:text-cyan-400"
                            >
                                <Mail size={18} />
                            </Link>
                            <Link
                                href="/profile"
                                className="hidden md:flex flex-col items-end group"
                            >
                                <span className="text-[10px] font-mono text-cyan-400/70 tracking-[0.2em] uppercase leading-none mb-1">Authenticated</span>
                                <span className="text-black dark:text-white font-black tracking-widest text-xs uppercase group-hover:text-cyan-400 transition-colors uppercase">{username}</span>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-gray-400 hover:text-red-500"
                                title="Disconnect"
                            >
                                <LogOut size={18} />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4"
                        >
                            <span className="hidden md:block text-[10px] font-mono text-red-500/70 tracking-[0.2em] uppercase leading-none">SYSTEM: GUEST MODE</span>
                            <Link
                                href="/login"
                                className="px-6 py-2 bg-white/10 dark:bg-white/5 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black border border-black/10 dark:border-white/10 transition-all font-mono text-xs uppercase tracking-widest flex items-center gap-2"
                            >
                                <User size={14} />
                                Login
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
}
