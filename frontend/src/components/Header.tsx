"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User, Mail, Users, BarChart3, Network } from 'lucide-react';
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
        <header className="fixed top-0 left-0 right-0 px-6 md:px-12 py-5 z-50 flex justify-between items-center bg-white/60 backdrop-blur-2xl border-b border-white/80 shadow-[0_5px_20px_rgba(0,0,0,0.02)] transition-all">
            {/* Logo */}
            <div>
                <Link href="/dashboard" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
                    <span className="font-bold text-[24px] text-slate-800 tracking-tight">Glysmork</span>
                    <Network className="text-slate-500 w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                    {username ? (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2.5"
                        >
                            <Link
                                href="/friends"
                                title="Your Connections"
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-slate-800 shadow-sm"
                            >
                                <Users size={18} />
                            </Link>
                            <Link
                                href="/messages"
                                title="Direct Messages"
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-slate-800 shadow-sm"
                            >
                                <Mail size={18} />
                            </Link>
                            <Link
                                href="/analytics"
                                title="Analytics"
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-slate-800 shadow-sm"
                            >
                                <BarChart3 size={18} />
                            </Link>
                            <Link
                                href="/profile"
                                title="Profile"
                                className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-slate-800 shadow-sm relative"
                            >
                                <User size={18} />
                                <div
                                    className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${onlineStatus ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}
                                />
                            </Link>
                            <Link
                                href="/profile"
                                className="hidden md:flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <div
                                    className={`w-2.5 h-2.5 rounded-full shadow-inner ${onlineStatus ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}
                                    title={onlineStatus ? 'Connected' : 'Disconnected'}
                                />
                                <span className="text-[14px] font-semibold text-slate-700">{username}</span>
                                <User size={15} className="text-slate-400" />
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-rose-50 hover:border-rose-200 transition-all text-slate-500 hover:text-rose-500 shadow-sm"
                                title="Sign out"
                            >
                                <LogOut size={18} />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3"
                        >
                            <Link
                                href="/login"
                                className="px-6 py-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 transition-all font-semibold text-[14px] flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                            >
                                <User size={16} />
                                Sign In
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
}
