"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { Zap, Shuffle, ArrowUpRight, User, LogOut, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [intent, setIntent] = useState('');
    const [username, setUsername] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [searchingIntent, setSearchingIntent] = useState<string | null>(null); // null = not searching
    const [exitNotification, setExitNotification] = useState<string | null>(null);
    const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) {
            window.location.href = '/login';
            return;
        }

        // Check for exit notification from chat
        const params = new URLSearchParams(window.location.search);
        if (params.get('exit') === 'partner') {
            setExitNotification("Connection severed by partner Node.");
            // Clear the URL param without refreshing
            window.history.replaceState({}, '', '/dashboard');
            setTimeout(() => setExitNotification(null), 5000);
        }
        try {
            const userData = JSON.parse(u);
            setUsername(userData.username);
        } catch (e) {
            console.error("Failed to parse user data");
            window.location.href = '/login';
        }

        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % 8);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getUsername = () => {
        try {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u)?.username : null;
        } catch { return null; }
    };

    const stopPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setSearchingIntent(null);
        setIsMatching(false);
    };

    const pollForMatch = (intentText: string) => {
        const tryMatch = async () => {
            try {
                const response = await fetchApi('/matchmaking/join/', {
                    method: 'POST',
                    body: JSON.stringify({ intent: intentText, username: getUsername() })
                });
                if (response.match_found || response.room_name) {
                    stopPolling();
                    window.location.href = `/chat/room?id=${response.room_name}`;
                } else if (response.status === 'discovery_results') {
                    stopPolling();
                    setDiscoveryResults(response.results);
                }
                // else: keep polling silently
            } catch {
                stopPolling();
            }
        };
        // Poll every 3s
        pollRef.current = setInterval(tryMatch, 3000);
    };

    const startRandomMatching = async () => {
        setIsMatching(true);
        const intentText = "Random Connection";
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intentText, username: getUsername() })
            });
            if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                // No match yet — start polling
                setSearchingIntent(intentText);
                pollForMatch(intentText);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
        }
    };

    const startMatching = async () => {
        if (!intent.trim()) return;
        setIsMatching(true);
        const intentText = intent;
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intentText, username: getUsername() })
            });
            if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                // No match yet — start polling
                setSearchingIntent(intentText);
                pollForMatch(intentText);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
        }
    };

    return (
        <main className="min-h-screen relative bg-slate-50 dark:bg-[#050511] text-slate-900 dark:text-white selection:bg-purple-500/30 overflow-hidden transition-colors duration-300">

            {/* Exit Notification Toast */}
            <AnimatePresence>
                {exitNotification && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-6 py-3 rounded-full font-mono text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-3"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        {exitNotification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== SCANNING NETWORK OVERLAY ===== */}
            {searchingIntent && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
                >
                    {/* Pulsing rings */}
                    <div className="relative flex items-center justify-center mb-10">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="absolute rounded-full border border-cyan-500/40"
                                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                                transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: 'easeOut' }}
                                style={{ width: 80, height: 80 }}
                            />
                        ))}
                        <div className="w-20 h-20 rounded-full border-2 border-t-cyan-400 border-r-purple-500 border-b-cyan-400 border-l-transparent animate-spin" />
                        <div className="absolute w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 animate-pulse" />
                    </div>

                    <h2 className="text-2xl font-black font-mono tracking-[0.3em] uppercase text-white mb-3">
                        Scanning Network
                    </h2>
                    <p className="font-mono text-sm text-slate-400 mb-2 border-l-2 border-cyan-500/50 pl-4 max-w-xs text-center">
                        {searchingIntent === 'Random Connection'
                            ? 'Waiting for another user to connect...'
                            : <>Looking for: <span className="text-cyan-400">"{searchingIntent}"</span></>
                        }
                    </p>
                    <p className="font-mono text-xs text-slate-600 mb-10">Retrying every 3 seconds automatically</p>

                    <button
                        onClick={stopPolling}
                        className="px-8 py-3 border border-red-500/40 text-red-400 font-mono text-xs uppercase tracking-widest hover:bg-red-500/10 transition-colors"
                    >
                        Cancel Search
                    </button>
                </motion.div>
            )}

            {/* ===== DISCOVERY RESULTS OVERLAY ===== */}
            {discoveryResults.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-6 overflow-y-auto"
                >
                    <div className="w-full max-w-4xl">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h2 className="text-3xl font-black font-mono tracking-widest text-white uppercase italic">Neural Discovery</h2>
                                <p className="text-cyan-400 font-mono text-sm mt-1">Found matching nodes for: "{searchingIntent || intent}"</p>
                            </div>
                            <button
                                onClick={() => setDiscoveryResults([])}
                                className="text-slate-500 hover:text-white transition-colors uppercase font-mono text-xs"
                            >
                                [ Close ]
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {discoveryResults.map((result, idx) => (
                                <motion.div
                                    key={result.username}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-white/5 border border-white/10 p-6 flex flex-col relative group overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-purple-500 opacity-50">NODE_{idx.toString().padStart(2, '0')}</div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl border border-white/20">
                                            {result.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-lg leading-none">{result.username}</h4>
                                            <div className="text-cyan-400 font-mono text-[10px] uppercase tracking-tighter mt-1">{result.score}% Neural Match</div>
                                        </div>
                                    </div>

                                    <p className="text-slate-400 text-xs font-mono mb-6 line-clamp-3 leading-relaxed italic border-l border-purple-500/30 pl-3">
                                        "{result.reason}"
                                    </p>

                                    <div className="mt-auto pt-6 border-t border-white/5">
                                        <button
                                            onClick={() => {
                                                // Create a room with this person
                                                const createAndChat = async () => {
                                                    try {
                                                        const res = await fetchApi('/matchmaking/join/', {
                                                            method: 'POST',
                                                            body: JSON.stringify({
                                                                intent: `DIRECT_CONNECT:${result.username}`,
                                                                username: getUsername()
                                                            })
                                                        });
                                                        if (res.room_name) {
                                                            window.location.href = `/chat/room?id=${res.room_name}`;
                                                        }
                                                    } catch (e) { console.error(e); }
                                                };
                                                createAndChat();
                                            }}
                                            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-[10px] tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            Connect Node
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Texture Layer */}
            <div className="bg-noise dark:opacity-5 opacity-20" />

            {/* Abstract Gradient Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/10 dark:bg-purple-900/20 blur-[120px] pointer-events-none transition-colors duration-500" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/10 dark:bg-cyan-900/20 blur-[100px] pointer-events-none transition-colors duration-500" />

            {/* Shared Header */}
            <Header />

            {/* Marquee Banner */}
            <div className="absolute top-32 w-[200%] -left-[50%] -rotate-2 overflow-hidden bg-cyan-100/50 dark:bg-cyan-900/10 border-y border-cyan-200 dark:border-cyan-500/20 py-3 z-0 flex pointer-events-none transition-colors">
                <div className="flex animate-marquee whitespace-nowrap">
                    {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 dark:from-cyan-400 dark:to-purple-400 mx-8 uppercase">
                            • Neural Hub Active • Find Your Node • Connect Now
                        </span>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center px-6 md:px-12 pt-40 pb-20">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

                    {/* Left Col: Typography & Controls */}
                    <div className="lg:col-span-7 flex flex-col items-start">

                        {/* Animated GLYSMORK logo */}
                        <div className="mb-8 flex items-end">
                            <h1 className="text-3xl md:text-4xl font-black tracking-[0.25em] flex gap-1">
                                {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((letter, index) => (
                                    <span
                                        key={index}
                                        className={`transition-all duration-300 inline-block bg-clip-text text-transparent ${index === activeIndex
                                            ? 'bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 -translate-y-2 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                                            : 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-gray-700 dark:to-gray-500'
                                            }`}
                                    >
                                        {letter}
                                    </span>
                                ))}
                            </h1>
                        </div>

                        <h2 className="text-6xl md:text-8xl lg:text-[100px] leading-[0.85] font-black tracking-tighter mb-6 text-slate-900 dark:text-white uppercase">
                            Your<br />Neural<br />Hub.
                        </h2>

                        <p className="text-lg md:text-xl text-slate-600 dark:text-gray-400 max-w-lg mb-12 font-mono leading-relaxed border-l-2 border-cyan-500/50 pl-6">
                            {username
                                ? <>Welcome back, <span className="text-cyan-400 font-bold">{username.toUpperCase()}</span>.<br />Describe your intent or connect instantly.</>
                                : <>Describe your intent. The Neural Engine finds the exact human.</>
                            }
                        </p>

                        {/* Intent Matchmaking Section */}
                        <div className="w-full max-w-xl space-y-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={intent}
                                    onChange={(e) => setIntent(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && startMatching()}
                                    placeholder="e.g. Someone who understands deep work and Stoicism..."
                                    className="flex-1 px-5 py-4 bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-all backdrop-blur-md"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={startMatching}
                                    disabled={!intent.trim() || isMatching}
                                    className={`px-6 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[4px_4px_0px_rgba(34,211,238,0.4)] border border-cyan-400 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_rgba(34,211,238,0.4)] ${!intent.trim() || isMatching ? 'opacity-40 cursor-not-allowed shadow-none translate-x-0 translate-y-0' : ''}`}
                                >
                                    {isMatching ? '...' : <><ArrowUpRight className="w-5 h-5" /></>}
                                </motion.button>
                            </div>

                            <div className="flex items-center gap-4 opacity-30">
                                <div className="flex-1 h-px bg-slate-400 dark:bg-white" />
                                <span className="font-mono text-xs uppercase tracking-widest">or</span>
                                <div className="flex-1 h-px bg-slate-400 dark:bg-white" />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={startRandomMatching}
                                disabled={isMatching}
                                className={`w-full px-8 py-4 bg-transparent text-slate-800 dark:text-white font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all border border-slate-300 dark:border-white/20 hover:bg-white/10 font-mono ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <Shuffle className="w-4 h-4" />
                                {isMatching ? 'Routing...' : 'Random Connection'}
                            </motion.button>
                        </div>

                    </div>

                    {/* Right Col: Floating Status Cards */}
                    <div className="lg:col-span-5 relative mt-20 lg:mt-0 h-[600px] w-full hidden md:block">

                        {/* Card 1 — Intent Engine */}
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="absolute top-10 right-0 w-72 bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-black/10 dark:border-white/10 p-6 z-20 shadow-xl"
                        >
                            <div className="flex justify-between items-start mb-12">
                                <Zap className="text-cyan-600 dark:text-cyan-400 w-6 h-6" />
                                <span className="text-xs font-mono text-slate-400 dark:text-gray-500">01</span>
                            </div>
                            <h3 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800 dark:text-white">Intent Engine</h3>
                            <p className="text-sm text-slate-600 dark:text-gray-400 font-mono">Describe who you need. The AI engine searches 10,000 profiles.</p>
                        </motion.div>

                        {/* Card 2 — Node Status */}
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="absolute top-64 left-0 lg:-left-12 w-80 bg-cyan-100/60 dark:bg-cyan-900/30 backdrop-blur-xl border border-cyan-300/40 dark:border-cyan-500/40 p-6 z-30 shadow-2xl"
                        >
                            <div className="flex justify-between items-start mb-12">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                    <span className="font-mono text-xs text-slate-500 dark:text-cyan-400 uppercase">ACTIVE NODE</span>
                                </div>
                                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-300">02</span>
                            </div>
                            <h3 className="text-2xl font-black mb-2 text-cyan-900 dark:text-cyan-100 uppercase tracking-wider">
                                {username ? username.toUpperCase() : 'YOUR NODE'}
                            </h3>
                            <p className="text-sm text-cyan-700/80 dark:text-cyan-200/70 font-mono leading-relaxed">Neural profile loaded. Ready for deep connection matching.</p>
                        </motion.div>

                        {/* Card 3 — Random Link */}
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="absolute bottom-10 right-10 w-64 bg-slate-50/80 dark:bg-black/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 z-10 shadow-lg"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <Shuffle className="text-purple-600 dark:text-purple-400 w-6 h-6" />
                                <span className="text-xs font-mono text-slate-400 dark:text-gray-600">03</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-gray-300 uppercase">Random Link</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">Instant routing to any available node. Zero intent required.</p>
                        </motion.div>

                    </div>

                </div>
            </div>
        </main>
    );
}
