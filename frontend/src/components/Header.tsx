"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, User, Mail, Users, BarChart3, Network, Gem, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation'; 
import { useNotification } from './NotificationProvider';
import { fetchApi } from '@/lib/api';

export default function Header() {
    const { onlineStatus } = useNotification();
    const [username, setUsername] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) {
            try {
                const userData = JSON.parse(u);
                setUsername(userData.username);
                fetchUnreadCount(userData.username);
            } catch (e) {
                console.error("Failed to parse user data in header");
            }
        }

        const handleUpdate = () => {
            const stored = localStorage.getItem('user');
            if (stored) {
                const userData = JSON.parse(stored);
                fetchUnreadCount(userData.username);
            }
        };

        window.addEventListener('sys_friend_message', handleUpdate);
        return () => window.removeEventListener('sys_friend_message', handleUpdate);
    }, []);

    const fetchUnreadCount = async (uname: string) => {
        try {
            const data = await fetchApi(`/matchmaking/notifications/?username=${encodeURIComponent(uname)}`);
            setUnreadCount(data.notifications?.length || 0);
        } catch {}
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.replace('/login?logout=true');
    };

    return (
        <header className="fixed top-0 left-0 right-0 px-3 sm:px-6 md:px-12 py-3 md:py-5 z-50 flex justify-between items-center bg-white/60 backdrop-blur-2xl border-b border-white/80 shadow-[0_5px_20px_rgba(0,0,0,0.02)] transition-all">
            {/* Logo */}
            <div>
                <Link href="/dashboard" className="flex items-center gap-1.5 md:gap-2 group transition-opacity hover:opacity-80">
                    <span className="font-bold text-[20px] md:text-[24px] text-slate-800 tracking-tight">Glysmork</span>
                    <Network className="text-slate-500 w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform duration-300" />
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                    {username ? (
                        <>
                            {/* Mobile Toggles */}
                            <div className="flex md:hidden items-center gap-2">
                                <Link
                                    href="/messages"
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all text-slate-500 relative shrink-0 shadow-sm"
                                >
                                    <Mail size={18} />
                                    {unreadCount > 0 && (
                                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center">
                                            <span className="text-[7px] font-bold text-white leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                        </div>
                                    )}
                                </Link>
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 transition-all text-slate-500 shrink-0 shadow-sm"
                                    title="Menu"
                                >
                                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                                </button>
                            </div>

                            {/* Desktop Nav */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="hidden md:flex items-center gap-2.5"
                            >
                                <Link
                                    href="/friends"
                                    title="Your Connections"
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-800 shadow-sm shrink-0"
                                >
                                    <Users size={18} />
                                </Link>
                                <Link
                                    href="/messages"
                                    title="Direct Messages"
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-800 shadow-sm relative shrink-0"
                                >
                                    <Mail size={18} />
                                    <AnimatePresence>
                                        {unreadCount > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center"
                                            >
                                                <span className="text-[7px] font-bold text-white leading-none">
                                                    {unreadCount > 9 ? '9+' : unreadCount}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Link>
                                <Link
                                    href="/analytics"
                                    title="Analytics"
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-800 shadow-sm shrink-0"
                                >
                                    <BarChart3 size={18} />
                                </Link>
                                <Link
                                    href="/wallet"
                                    title="Subscription & Gems"
                                    className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all shadow-sm shrink-0 ${
                                        pathname === '/wallet'
                                            ? 'bg-sky-50 border-sky-200 text-sky-600'
                                            : 'bg-white/80 border-slate-200/60 hover:bg-sky-50 hover:border-sky-200 text-slate-400 hover:text-sky-500'
                                    }`}
                                >
                                    <Gem size={17} />
                                </Link>
                                <Link
                                    href="/profile"
                                    title="Profile"
                                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/80 border border-slate-200/60 hover:bg-slate-50 transition-all shadow-sm"
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
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 border border-slate-200/60 hover:bg-rose-50 hover:border-rose-200 transition-all text-slate-500 hover:text-rose-500 shadow-sm shrink-0"
                                    title="Sign out"
                                >
                                    <LogOut size={18} />
                                </button>
                            </motion.div>
                        </>
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

            {/* Mobile Dropdown Menu */}
            <AnimatePresence>
                {username && isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
                        className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl md:hidden flex flex-col p-4 gap-2 z-40 origin-top"
                    >
                        <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium border border-transparent hover:border-slate-100 transition-all">
                            <User size={18} className="text-slate-400" /> Profile
                        </Link>
                        <Link href="/friends" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium border border-transparent hover:border-slate-100 transition-all">
                            <Users size={18} className="text-slate-400" /> Connections
                        </Link>
                        <Link href="/wallet" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium border border-transparent hover:border-slate-100 transition-all">
                            <Gem size={18} className="text-slate-400" /> Wallet & Gems
                        </Link>
                        <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium border border-transparent hover:border-slate-100 transition-all">
                            <BarChart3 size={18} className="text-slate-400" /> Analytics
                        </Link>
                        <hr className="my-1 border-slate-100" />
                        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-50 text-rose-600 font-medium border border-transparent hover:border-rose-100 transition-all text-left w-full">
                            <LogOut size={18} className="text-rose-400" /> Sign Out
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
