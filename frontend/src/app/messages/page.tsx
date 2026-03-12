"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Header from '@/components/Header';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, ArrowRight, User, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Conversation {
    room_name: string;
    partner_username: string;
    partner_image: string | null;
    last_message: string;
    last_message_time: string | null;
    is_active: boolean;
}

export default function InboxPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) {
            window.location.href = '/login';
            return;
        }
        try {
            const data = JSON.parse(u);
            setUsername(data.username);
            fetchConversations(data.username);
        } catch (e) {
            window.location.href = '/login';
        }
    }, []);

    const fetchConversations = async (currUser: string) => {
        try {
            const res = await fetchApi(`/room/conversations/?username=${encodeURIComponent(currUser)}`);
            if (Array.isArray(res)) {
                setConversations(res);
            }
        } catch (e) {
            console.error("Failed to fetch conversations", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-[#050511] text-slate-900 dark:text-white transition-colors duration-300 overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/10 dark:bg-cyan-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30vw] h-[30vw] rounded-full bg-purple-500/10 dark:bg-purple-900/10 blur-[100px] pointer-events-none" />

            <Header />

            <div className="relative z-10 w-full max-w-4xl mx-auto pt-40 pb-20 px-6">
                <header className="mb-12">
                    <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Neural Inbox</h1>
                    <div className="h-1 w-20 bg-gradient-to-r from-cyan-500 to-purple-600 mb-6" />
                    <p className="font-mono text-sm text-slate-500 dark:text-gray-400">Previous sessions and active nodes stored in memory.</p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <div className="w-10 h-10 border-2 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin mb-4" />
                        <span className="font-mono text-xs uppercase tracking-widest">Accessing Logs...</span>
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="bg-white/5 border border-dashed border-white/10 p-12 text-center rounded-sm">
                        <MessageSquare className="w-12 h-12 mx-auto mb-6 text-slate-300 dark:text-gray-700" />
                        <h3 className="text-xl font-bold mb-2">No active traces found.</h3>
                        <p className="text-sm text-slate-500 dark:text-gray-500 font-mono mb-8">Your neural history is empty. Start a new connection from the dashboard.</p>
                        <Link href="/dashboard" className="px-8 py-3 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs hover:bg-cyan-400 transition-colors">
                            Initialize Matchmaking
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence>
                            {conversations.map((conv, idx) => (
                                <motion.div
                                    key={conv.room_name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group relative"
                                >
                                    <Link
                                        href={`/chat/room?id=${conv.room_name}`}
                                        className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-cyan-500/50 transition-all backdrop-blur-md relative overflow-hidden"
                                    >
                                        {/* Status Glow */}
                                        <div className={`absolute top-0 left-0 w-1 h-full ${conv.is_active ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-gray-800'}`} />

                                        {/* Partner Info */}
                                        <div className="flex items-center gap-4 min-w-[200px]">
                                            <div className="relative">
                                                <div className="w-14 h-14 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-gray-800 dark:to-gray-900 border border-slate-300 dark:border-white/10 flex items-center justify-center text-xl font-black">
                                                    {conv.partner_username.charAt(0).toUpperCase()}
                                                </div>
                                                {conv.is_active && (
                                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#050511] animate-pulse" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-black uppercase tracking-wider text-sm group-hover:text-cyan-500 transition-colors">{conv.partner_username}</h3>
                                                <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase tracking-tighter">NODE_UNID_{conv.room_name.split('_').pop()}</span>
                                            </div>
                                        </div>

                                        {/* Message Summary */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-600 dark:text-gray-400 text-sm italic line-clamp-1 mb-1 font-mono">
                                                "{conv.last_message}"
                                            </p>
                                            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 dark:text-gray-600 uppercase">
                                                <Clock className="w-3 h-3" />
                                                {conv.last_message_time || 'Session Started'}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div className="hidden md:flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Re-Access</span>
                                            <ArrowRight className="w-5 h-5 text-slate-300 dark:text-gray-800 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </main>
    );
}
