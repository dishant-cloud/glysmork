"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { Zap, Shuffle, ArrowUpRight, User, LogOut, AlertTriangle, MessageSquare, Phone, Video, Bell } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import { useNotification } from '@/components/NotificationProvider';

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [intent, setIntent] = useState('');
    const [username, setUsername] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [searchingIntent, setSearchingIntent] = useState<string | null>(null);
    const [exitNotification, setExitNotification] = useState<string | null>(null);
    const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);
    // Case 3: AI Support Chat
    const [supportChatOpen, setSupportChatOpen] = useState(false);
    const [supportMessages, setSupportMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [supportInput, setSupportInput] = useState('');
    const [supportLoading, setSupportLoading] = useState(false);
    const [readyToConnect, setReadyToConnect] = useState(false);
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { sendSignal } = useNotification();
    const [onlineCount, setOnlineCount] = useState<number>(0);
    const [totalUsers, setTotalUsers] = useState<number>(0);
    const [friendRequested, setFriendRequested] = useState<Set<string>>(new Set());
    const [chatNotifs, setChatNotifs] = useState<{ id: number; sender: string; message: string; room_name: string }[]>([]);

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

        // Fetch online count
        const fetchOnline = async () => {
            try {
                const res = await fetch('http://127.0.0.1:8001/api/users/online-count/');
                if (res.ok) {
                    const data = await res.json();
                    setOnlineCount(data.online_count);
                    setTotalUsers(data.total_users);
                }
            } catch {}
            // Send heartbeat to keep this user's last_seen fresh
            const u = getUsername();
            if (u) {
                try {
                    await fetch('http://127.0.0.1:8001/api/users/heartbeat/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: u }),
                    });
                } catch {}
            }
        };
        fetchOnline();
        const onlineInterval = setInterval(fetchOnline, 15000);

        // Poll for chat notifications
        const fetchNotifs = async () => {
            const u = getUsername();
            if (!u) return;
            try {
                const res = await fetch(`http://127.0.0.1:8001/api/matchmaking/notifications/?username=${encodeURIComponent(u)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.notifications?.length > 0) {
                        setChatNotifs(data.notifications);
                        const ids = data.notifications.map((n: any) => n.id);
                        setTimeout(async () => {
                            try {
                                await fetch('http://127.0.0.1:8001/api/matchmaking/notifications/', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ ids }),
                                });
                                setChatNotifs([]);
                            } catch {}
                        }, 8000);
                    }
                }
            } catch {}
        };
        fetchNotifs();
        const notifInterval = setInterval(fetchNotifs, 5000);

        const handleCallAccepted = (e: any) => {
            if (e.detail) {
                window.location.href = `/chat/room?id=${e.detail}`;
            }
        };

        const handleCallDeclined = () => {
            setRingingUsername(null);
            alert("The node declined your connection request.");
        };

        window.addEventListener('call_accepted', handleCallAccepted);
        window.addEventListener('call_declined', handleCallDeclined);

        return () => {
            clearInterval(interval);
            clearInterval(onlineInterval);
            clearInterval(notifInterval);
            window.removeEventListener('call_accepted', handleCallAccepted);
            window.removeEventListener('call_declined', handleCallDeclined);
        };
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
                    window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || 'chat'}`;
                } else if (response.status === 'discovery_results') {
                    stopPolling();
                    setDiscoveryResults(response.results);
                } else if (response.status === 'no_results') {
                    stopPolling();
                    alert(response.message); // Fallback to alert for now, using existing pattern
                }
            } catch {
                stopPolling();
            }
        };
        // Poll every 3s
        pollRef.current = setInterval(tryMatch, 3000);
    };

    const startPersonaMatch = async () => {
        setIsMatching(true);
        const intentText = "Persona Match";
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intentText, username: getUsername() })
            });
            if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || 'chat'}`;
            } else {
                setSearchingIntent(intentText);
                pollForMatch(intentText);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
        }
    };

    const startOmegleMatch = async (mode: 'video' | 'chat') => {
        setIsMatching(true);
        const intentText = `Random Opposite Gender ${mode}`;
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intentText, username: getUsername() })
            });
            if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || mode}`;
            } else {
                setSearchingIntent(intentText);
                pollForMatch(intentText);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
        }
    };

    const startMatching = async (overrideIntent?: string) => {
        const intentText = overrideIntent || intent;
        if (!intentText.trim()) return;
        setIsMatching(true);
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intentText, username: getUsername() })
            });
            if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || 'chat'}`;
            } else if (response.status === 'discovery_results') {
                setIsMatching(false);
                setDiscoveryResults(response.results);
            } else if (response.status === 'no_results') {
                setIsMatching(false);
                alert(response.message);
            } else {
                setSearchingIntent(intentText);
                pollForMatch(intentText);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
        }
    };

    // ===== CASE 3: AI SUPPORT CHAT HANDLERS =====
    const openSupportChat = async () => {
        setSupportChatOpen(true);
        setSupportMessages([]);
        setReadyToConnect(false);
        setSupportLoading(true);
        try {
            const res = await fetchApi('/matchmaking/support-chat/', {
                method: 'POST',
                body: JSON.stringify({ username: getUsername(), message: '', history: [] })
            });
            const aiMsg = { role: 'model' as const, text: res.reply };
            setSupportMessages([aiMsg]);
            if (res.ready_to_connect) setReadyToConnect(true);
        } catch {
            setSupportMessages([{ role: 'model', text: "Hey, I'm here for you. What's on your mind?" }]);
        } finally {
            setSupportLoading(false);
        }
    };

    const sendSupportMessage = async () => {
        if (!supportInput.trim() || supportLoading) return;
        const userMsg = { role: 'user' as const, text: supportInput.trim() };
        const newHistory = [...supportMessages, userMsg];
        setSupportMessages(newHistory);
        setSupportInput('');
        setSupportLoading(true);
        // Scroll to bottom
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        try {
            // Build history for API (exclude the current user message, it's in 'message')
            const historyForApi = supportMessages.map(m => ({ role: m.role, text: m.text }));
            const res = await fetchApi('/matchmaking/support-chat/', {
                method: 'POST',
                body: JSON.stringify({
                    username: getUsername(),
                    message: userMsg.text,
                    history: historyForApi
                })
            });
            const aiMsg = { role: 'model' as const, text: res.reply };
            setSupportMessages(prev => [...prev, aiMsg]);
            if (res.ready_to_connect) setReadyToConnect(true);
        } catch {
            setSupportMessages(prev => [...prev, { role: 'model', text: "I'm still here. Take your time." }]);
        } finally {
            setSupportLoading(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    };

    const closeSupportChat = () => {
        setSupportChatOpen(false);
        setSupportMessages([]);
        setReadyToConnect(false);
        setSupportInput('');
    };

    return (
        <main className="min-h-screen relative bg-slate-50 dark:bg-[#050511] text-slate-900 dark:text-white selection:bg-purple-500/30 overflow-hidden transition-colors duration-300">

            {/* ===== CASE 3: AI SUPPORT CHAT OVERLAY ===== */}
            <AnimatePresence>
                {supportChatOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex flex-col bg-[#08080f] backdrop-blur-2xl"
                    >
                        {/* Ambient glows */}
                        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-700/8 blur-[160px] pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-rose-600/6 blur-[120px] pointer-events-none" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <motion.div
                                    animate={{ scale: [1, 1.12, 1] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/40 to-rose-500/40 border border-indigo-400/30 flex items-center justify-center text-lg"
                                >
                                    💙
                                </motion.div>
                                <div>
                                    <h2 className="text-white font-black text-sm uppercase tracking-widest">Companion AI</h2>
                                    <span className="text-[10px] font-mono text-indigo-400">● Listening</span>
                                </div>
                            </div>
                            <button
                                onClick={closeSupportChat}
                                className="text-slate-500 hover:text-white transition-colors text-xs font-mono uppercase tracking-widest border border-white/10 px-3 py-1.5 hover:bg-white/5"
                            >
                                Close
                            </button>
                        </div>

                        {/* Crisis banner */}
                        <div className="px-6 py-2 bg-yellow-400/5 border-b border-yellow-500/15 flex-shrink-0">
                            <p className="text-yellow-400/70 text-[10px] font-mono text-center">
                                ⚠️ In immediate danger? Contact a local helpline or emergency services.
                            </p>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
                            {supportMessages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'model' && (
                                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">💙</div>
                                    )}
                                    <div
                                        className={`max-w-[75%] px-4 py-3 text-sm font-mono leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-white/8 border border-white/10 text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm'
                                                : 'bg-indigo-500/10 border border-indigo-400/20 text-indigo-100 rounded-r-2xl rounded-tl-2xl rounded-bl-sm'
                                        }`}
                                    >
                                        {msg.text}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Typing indicator */}
                            {supportLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start items-center gap-2"
                                >
                                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-sm">💙</div>
                                    <div className="flex gap-1.5 bg-indigo-500/10 border border-indigo-400/20 px-4 py-3 rounded-r-2xl rounded-tl-2xl">
                                        {[0, 1, 2].map(i => (
                                            <motion.span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                                                animate={{ y: [0, -5, 0] }}
                                                transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity }}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Connect button — appears when AI says ready */}
                            {readyToConnect && !supportLoading && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex justify-center pt-4"
                                >
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => { closeSupportChat(); startPersonaMatch(); }}
                                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-rose-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.6)] transition-all animate-pulse"
                                    >
                                        💙 Connect me with a real person
                                    </motion.button>
                                </motion.div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <div className="flex-shrink-0 border-t border-white/8 px-4 sm:px-8 py-4">
                            <div className="flex gap-3 max-w-3xl mx-auto">
                                <input
                                    type="text"
                                    value={supportInput}
                                    onChange={e => setSupportInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendSupportMessage()}
                                    placeholder="Type how you're feeling..."
                                    disabled={supportLoading}
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-indigo-400/50 transition-all disabled:opacity-40"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={sendSupportMessage}
                                    disabled={!supportInput.trim() || supportLoading}
                                    className="px-5 py-3 bg-indigo-600/80 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs transition-all border border-indigo-400/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Send
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* ===== CHAT NOTIFICATION TOASTS ===== */}
            <div className="fixed top-28 right-6 z-[60] flex flex-col gap-3 max-w-sm w-80">
                <AnimatePresence>
                    {chatNotifs.map((notif) => (
                        <motion.div
                            key={notif.id}
                            initial={{ x: 120, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 120, opacity: 0 }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="bg-[#111118] border border-cyan-500/30 rounded-xl px-4 py-4 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                                    {notif.sender.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-bold truncate">{notif.sender}</p>
                                    <p className="text-gray-400 text-xs font-mono">wants to chat with you!</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/messages/${notif.sender}`}
                                    className="flex-1 py-2 text-center bg-cyan-500 text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-cyan-400 transition-colors shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                                >
                                    💬 Reply
                                </Link>
                                <button
                                    onClick={async () => {
                                        try {
                                            await fetchApi('/matchmaking/friends/', {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    username: getUsername(),
                                                    target_username: notif.sender,
                                                    action: 'request',
                                                }),
                                            });
                                            // Mark this notif as read so it fades away
                                            await fetch('http://127.0.0.1:8001/api/matchmaking/notifications/', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ ids: [notif.id] }),
                                            });
                                            setChatNotifs(prev => prev.filter(n => n.id !== notif.id));
                                        } catch {}
                                    }}
                                    className="flex-1 py-2 text-center bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
                                >
                                    ➕ Add Friend
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>


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
                            : <>Looking for: <span className="text-cyan-400">&quot;{searchingIntent}&quot;</span></>
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

            {/* ===== NEURAL SEARCH RESULTS OVERLAY ===== */}
            {discoveryResults.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-6 overflow-y-auto"
                >
                    <div className="w-full max-w-5xl">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h2 className="text-3xl font-black font-mono tracking-widest text-white uppercase italic">Neural Search Results</h2>
                                <p className="text-cyan-400 font-mono text-sm mt-1">AI-Ranked candidates for: &quot;{searchingIntent || intent}&quot;</p>
                            </div>
                            <button
                                onClick={() => setDiscoveryResults([])}
                                className="text-slate-500 hover:text-white transition-colors uppercase font-mono text-xs border border-white/10 px-4 py-2 hover:bg-white/5"
                            >
                                [ Terminate Search ]
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {discoveryResults.map((result, idx) => (
                                <motion.div
                                    key={result.username}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-white/5 border border-white/10 p-6 flex flex-col relative group overflow-hidden border-t-2 border-t-cyan-500/20"
                                >
                                    {/* Score Indicator */}
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="text-[10px] font-mono text-cyan-400 border border-cyan-400/30 px-2 py-0.5 bg-cyan-400/5">
                                            {result.score}% MATCH
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-none bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center text-white font-black text-2xl border border-white/10">
                                                {result.username.charAt(0).toUpperCase()}
                                            </div>
                                            {result.is_online && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-black text-lg leading-none uppercase tracking-tight">{result.username}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-mono uppercase ${result.is_online ? 'text-green-400' : 'text-slate-500'}`}>
                                                    {result.is_online ? '● Online' : '○ Offline'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Match Tags */}
                                    <div className="flex flex-wrap gap-1 mb-4">
                                        {result.match_tags?.map((tag: string) => (
                                            <span key={tag} className="text-[9px] font-mono text-purple-400 border border-purple-500/20 px-1.5 py-0.5 bg-purple-500/5">
                                                #{tag.toUpperCase()}
                                            </span>
                                        ))}
                                    </div>

                                    <p className="text-slate-400 text-xs font-mono mb-6 line-clamp-3 leading-relaxed border-l-2 border-cyan-500/30 pl-3">
                                        {result.reason}
                                    </p>

                                    {/* Expertise/Interests Quick View */}
                                    <div className="mb-6 grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[8px] font-mono text-slate-500 uppercase block mb-1">Expertise</span>
                                            <div className="text-[10px] text-slate-300 truncate">
                                                {result.expertise?.join(', ') || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-mono text-slate-500 uppercase block mb-1">Interests</span>
                                            <div className="text-[10px] text-slate-300 truncate">
                                                {result.interests?.join(', ') || 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
                                        {/* Row 1: Chat (instant) + Add Friend */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => {
                                                    // Fire notification to target, then go directly to DM
                                                    fetch('http://127.0.0.1:8001/api/matchmaking/notify/', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            sender: getUsername(),
                                                            receiver: result.username,
                                                            room_name: `direct_${[getUsername(), result.username].sort().join('_')}`,
                                                        }),
                                                    }).catch(() => {});
                                                    window.location.href = `/messages/${result.username}`;
                                                }}
                                                className="flex items-center justify-center gap-2 py-3 bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 transition-all font-mono text-[10px] uppercase tracking-widest"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                Message
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (friendRequested.has(result.username)) return;
                                                    try {
                                                        await fetchApi('/matchmaking/friends/', {
                                                            method: 'POST',
                                                            body: JSON.stringify({
                                                                username: getUsername(),
                                                                target_username: result.username,
                                                                action: 'request',
                                                            }),
                                                        });
                                                        setFriendRequested(prev => new Set([...prev, result.username]));
                                                    } catch {}
                                                }}
                                                className={`flex items-center justify-center gap-2 py-3 border transition-all font-mono text-[10px] uppercase tracking-widest ${
                                                    friendRequested.has(result.username)
                                                        ? 'bg-green-500/10 border-green-500/40 text-green-400 cursor-default'
                                                        : 'bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500 hover:text-white hover:border-purple-400'
                                                }`}
                                            >
                                                <User className="w-4 h-4" />
                                                {friendRequested.has(result.username) ? 'Requested ✓' : 'Add Friend'}
                                            </button>
                                        </div>
                                        {/* Row 2: Voice + Video (online only) */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { icon: Phone, mode: 'voice', label: 'Voice' },
                                                { icon: Video, mode: 'video', label: 'Video' },
                                            ].map((btn) => {
                                                const isOffline = !result.is_online;
                                                const isRinging = ringingUsername === result.username;
                                                return (
                                                    <button
                                                        key={btn.mode}
                                                        disabled={isOffline || isRinging}
                                                        onClick={async () => {
                                                            try {
                                                                setRingingUsername(result.username);
                                                                const res = await fetchApi('/matchmaking/join/', {
                                                                    method: 'POST',
                                                                    body: JSON.stringify({
                                                                        intent: `DIRECT_CONNECT:${result.username}:${btn.mode}`,
                                                                        username: getUsername(),
                                                                    }),
                                                                });
                                                                if (res.room_name) {
                                                                    sendSignal('initiate_call', {
                                                                        target_user_id: result.id,
                                                                        room_id: res.room_name,
                                                                        mode: btn.mode,
                                                                    });
                                                                }
                                                            } catch { setRingingUsername(null); }
                                                        }}
                                                        className={`flex items-center justify-center gap-2 py-3 border transition-all font-mono text-[10px] uppercase tracking-widest ${
                                                            isOffline
                                                                ? 'opacity-25 cursor-not-allowed border-white/10 text-gray-600'
                                                                : isRinging
                                                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400 animate-pulse'
                                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-cyan-500 hover:text-black hover:border-cyan-400'
                                                        }`}
                                                        title={isOffline ? 'User offline' : btn.label}
                                                    >
                                                        <btn.icon className="w-4 h-4" />
                                                        {isRinging ? 'Ringing...' : btn.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
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

                        {/* Online Count Badge */}
                        <div className="flex items-center gap-3 mb-10 font-mono text-sm">
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                                <span className="text-green-400 font-bold">{onlineCount}</span>
                                <span className="text-gray-500">nodes active now</span>
                            </div>
                            <span className="text-gray-600 text-xs">/ {totalUsers} total</span>
                        </div>

                        {/* Mode 1: Intent Matchmaking Section */}
                        <div className="w-full max-w-xl space-y-4 mb-10">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-cyan-400">01. Neural Search</h3>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={intent}
                                    onChange={(e) => setIntent(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && startMatching()}
                                    placeholder="e.g. Someone who understands deep work..."
                                    className="flex-1 px-5 py-4 bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-all backdrop-blur-md"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => startMatching()}
                                    disabled={!intent.trim() || isMatching}
                                    className={`px-6 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-[4px_4px_0px_rgba(34,211,238,0.4)] border border-cyan-400 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_rgba(34,211,238,0.4)] ${!intent.trim() || isMatching ? 'opacity-40 cursor-not-allowed shadow-none translate-x-0 translate-y-0' : ''}`}
                                >
                                    {isMatching ? '...' : <><ArrowUpRight className="w-5 h-5" /></>}
                                </motion.button>
                            </div>
                        </div>

                        {/* Mode 2: Persona Match */}
                        <div className="w-full max-w-xl space-y-4 mb-10">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-purple-400">02. Persona Match</h3>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={startPersonaMatch}
                                disabled={isMatching}
                                className={`w-full px-6 py-5 bg-purple-500/10 text-slate-800 dark:text-white font-bold uppercase tracking-widest flex items-center justify-between transition-all border border-purple-500/30 hover:bg-purple-500/20 font-mono ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <User className="w-5 h-5 text-purple-500" />
                                    <span className="text-sm">Match Based On My Profile</span>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-purple-500" />
                            </motion.button>
                        </div>

                        {/* Mode 3: Omegle Roulette */}
                        <div className="w-full max-w-xl space-y-4">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-green-400">03. Roulette (M/F)</h3>
                                <span className="text-[10px] font-mono text-slate-500 mr-2 border border-slate-500/30 px-2 py-0.5">Strict Male/Female</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => startOmegleMatch('chat')}
                                    disabled={isMatching}
                                    className={`w-full py-4 bg-transparent text-slate-800 dark:text-white font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-300 dark:border-white/20 hover:bg-white/10 font-mono text-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <MessageSquare className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                                    Text Chat
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => startOmegleMatch('video')}
                                    disabled={isMatching}
                                    className={`w-full py-4 bg-green-500/10 text-slate-800 dark:text-green-400 font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-green-500/40 hover:bg-green-500/20 font-mono text-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <Video className="w-4 h-4 text-green-500" />
                                    Video Chat
                                </motion.button>
                            </div>
                        </div>

                        {/* Mode 4: Talk to Someone (AI Emotional Support) */}
                        <div className="w-full max-w-xl space-y-4 mt-10">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-rose-400">04. Talk to Someone</h3>
                                <span className="text-[10px] font-mono text-slate-500 mr-2 border border-rose-500/20 px-2 py-0.5 text-rose-400/60">AI Companion</span>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={openSupportChat}
                                className="w-full px-6 py-5 bg-rose-500/8 text-slate-800 dark:text-white font-bold uppercase tracking-widest flex items-center justify-between transition-all border border-rose-500/20 hover:bg-rose-500/15 hover:border-rose-400/40 font-mono group"
                            >
                                <div className="flex items-center gap-4">
                                    <motion.span
                                        animate={{ scale: [1, 1.15, 1] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                        className="text-xl"
                                    >💙</motion.span>
                                    <div className="text-left">
                                        <span className="text-sm block">Feeling down? Just talk.</span>
                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-500 normal-case font-normal">AI listens first, then connects you to a real person</span>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity" />
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

                        {/* Card 2 — Persona Sync */}
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="absolute top-64 left-0 lg:-left-12 w-80 bg-purple-100/60 dark:bg-purple-900/30 backdrop-blur-xl border border-purple-300/40 dark:border-purple-500/40 p-6 z-30 shadow-2xl"
                        >
                            <div className="flex justify-between items-start mb-12">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                    <span className="font-mono text-xs text-slate-500 dark:text-purple-400 uppercase">ACTIVE NODE</span>
                                </div>
                                <span className="text-xs font-mono text-purple-600 dark:text-purple-300">02</span>
                            </div>
                            <h3 className="text-2xl font-black mb-2 text-purple-900 dark:text-purple-100 uppercase tracking-wider">
                                {username ? username.toUpperCase() : 'YOUR NODE'}
                            </h3>
                            <p className="text-sm text-purple-700/80 dark:text-purple-200/70 font-mono leading-relaxed">Neural persona loaded. Ready for profile-based blind matching.</p>
                        </motion.div>

                        {/* Card 3 — Roulette */}
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="absolute bottom-10 right-10 w-64 bg-slate-50/80 dark:bg-black/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 z-10 shadow-lg"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <Video className="text-green-600 dark:text-green-400 w-6 h-6" />
                                <span className="text-xs font-mono text-slate-400 dark:text-gray-600">03</span>
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-gray-300 uppercase">M/F Roulette</h3>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">Strict opposite-gender video and chat routing.</p>
                        </motion.div>

                    </div>

                </div>
            </div>
        </main>
    );
}
