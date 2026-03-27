"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User, Mail, Users } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation'; 
import { useNotification } from './NotificationProvider';

export default function Header() {
    const { onlineStatus } = useNotification();
    const [username, setUsername] = useState<string | null>(null);
    const pathname = usePathname();

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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.replace('/login');
    };

    return (
        <header className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-between items-center pointer-events-none">
            <div className="pointer-events-auto">
                <Link href="/dashboard" replace={pathname !== '/dashboard'} className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center rounded-xl group-hover:rotate-12 transition-transform duration-500 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                        <span className="text-white font-black text-xl tracking-tighter">G</span>
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
                                href="/friends"
                                replace={pathname !== '/dashboard'}
                                title="Your Connections"
                                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-gray-400 hover:text-purple-400"
                            >
                                <Users size={18} />
                            </Link>
                            <Link
                                href="/messages"
                                replace={pathname !== '/dashboard'}
                                title="Direct Messages"
                                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-gray-400 hover:text-cyan-400"
                            >
                                <Mail size={18} />
                            </Link>
                            <Link
                                href="/profile"
                                replace={pathname !== '/dashboard'}
                                className="hidden md:flex flex-col items-end group"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-cyan-400/60 tracking-tight leading-none">Signed in as</span>
                                    <div 
                                        className={`w-1.5 h-1.5 rounded-full ${onlineStatus ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}
                                        title={onlineStatus ? 'WebSocket Connected' : 'WebSocket Disconnected'}
                                    />
                                </div>
                                <span className="text-black dark:text-white font-bold tracking-tight text-sm group-hover:text-cyan-400 transition-colors uppercase">{username}</span>
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
                            <span className="hidden md:block text-[10px] font-bold text-red-500/50 tracking-tight">Guest Mode</span>
                            <Link
                                href="/login"
                                className="px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:scale-105 border border-black dark:border-white transition-all font-bold text-xs flex items-center gap-2 shadow-lg"
                            >
                                <User size={14} />
                                Sign In
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
}
