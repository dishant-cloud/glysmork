"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { Zap, Shuffle, ArrowUpRight, User, LogOut, AlertTriangle, MessageSquare, Phone, Video, Bell } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '@/components/Header';
import { useNotification } from '@/components/NotificationProvider';
import { useCall } from '@/components/CallProvider';

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [intent, setIntent] = useState('');
    const [username, setUsername] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [searchingIntent, setSearchingIntent] = useState<string | null>(null);
    const [exitNotification, setExitNotification] = useState<string | null>(null);
    const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);

    const [pollRef, setPollRef] = useState<ReturnType<typeof setInterval> | null>(null);
    const { sendSignal } = useNotification();
    const { startCall, endCall, callState } = useCall();
    const [onlineCount, setOnlineCount] = useState<number>(0);
    const [totalUsers, setTotalUsers] = useState<number>(0);
    const [friendRequested, setFriendRequested] = useState<Set<string>>(new Set());
    const [chatNotifs, setChatNotifs] = useState<{ id: number; sender: string; message: string; room_name: string; isFriend?: boolean; isPending?: boolean }[]>([]);
    const shownNotifsRef = useRef<Set<number>>(new Set());

    // Matchmaking Filters & Modes
    const [isOffline, setIsOffline] = useState(false);
    const [modePref, setModePref] = useState<'chat' | 'video'>('chat');
    const [locationFilter, setLocationFilter] = useState('');
    const [countryFilter, setCountryFilter] = useState<string[]>([]);
    const [languageFilter, setLanguageFilter] = useState<string[]>([]);
    const [distanceKm, setDistanceKm] = useState(0);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) {
            window.location.href = '/login';
            return;
        }

        // Check for exit notification from chat
        const params = new URLSearchParams(window.location.search);
        if (params.get('exit') === 'partner') {
            setExitNotification("Connection severed by partner.");
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
                const res = await fetch('http://127.0.0.1:8000/api/users/online-count/');
                if (res.ok) {
                    const data = await res.json();
                    setOnlineCount(data.online_count);
                    setTotalUsers(data.total_users);
                }
            } catch { }
            // Send heartbeat to keep this user's last_seen fresh
            const u = getUsername();
            if (u) {
                try {
                    await fetch('http://127.0.0.1:8000/api/users/heartbeat/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: u }),
                    });
                } catch { }
            }
        };
        fetchOnline();
        const onlineInterval = setInterval(fetchOnline, 15000);

        const fetchNotifs = async () => {
            const u = getUsername();
            if (!u) return;
            try {
                // Fetch friends list to check if sender is already a friend
                const friendRes = await fetch(`http://127.0.0.1:8000/api/matchmaking/friends/?username=${encodeURIComponent(u)}`);
                let friendData = { friends: [], sent: [] };
                if (friendRes.ok) {
                    friendData = await friendRes.json();
                }

                const res = await fetch(`http://127.0.0.1:8000/api/matchmaking/notifications/?username=${encodeURIComponent(u)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.notifications?.length > 0) {
                        const unshown = data.notifications.filter((n: any) => !shownNotifsRef.current.has(n.id));
                        if (unshown.length > 0) {
                            const now = new Date().getTime();
                            const freshNotifs = unshown.filter((n: any) => {
                                const createdAt = new Date(n.created_at).getTime();
                                return (now - createdAt) < 60000; // Only show toast if < 60s old
                            });

                            if (freshNotifs.length > 0) {
                                // Annotate fresh notifs with friendship status
                                const annotated = freshNotifs.map((n: any) => {
                                    const isFriend = friendData.friends?.some((f: any) => (f.username === n.sender || f === n.sender));
                                    const isPending = friendData.sent?.some((f: any) => (f.username === n.sender || f === n.sender));
                                    return { ...n, isFriend, isPending };
                                });

                                setChatNotifs(prev => [...prev, ...annotated]);
                                setTimeout(() => {
                                    setChatNotifs(prev => prev.filter(n => !annotated.find((nn: any) => nn.id === n.id)));
                                }, 8000);
                            }

                            // Mark all as shown so they don't pop up again even if stale
                            unshown.forEach((n: any) => shownNotifsRef.current.add(n.id));
                        }
                    }
                }
            } catch { }
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
            alert("The user declined your connection request.");
        };

        window.addEventListener('sys_call_answered', handleCallAccepted);
        window.addEventListener('sys_call_declined', handleCallDeclined);

        return () => {
            clearInterval(interval);
            clearInterval(onlineInterval);
            clearInterval(notifInterval);
            window.removeEventListener('sys_call_answered', handleCallAccepted);
            window.removeEventListener('sys_call_declined', handleCallDeclined);
        };
    }, []);


    const getUsername = () => {
        try {
            const u = localStorage.getItem('user');
            return u ? JSON.parse(u)?.username : null;
        } catch { return null; }
    };

    const stopPolling = () => {
        if (pollRef) clearInterval(pollRef);
        setPollRef(null);
        setSearchingIntent(null);
        setIsMatching(false);
    };

    const pollForMatch = (intentText: string) => {
        const tryMatch = async () => {
            try {
                const response = await fetchApi('/matchmaking/join/', {
                    method: 'POST',
                    body: JSON.stringify({
                        intent: intentText,
                        username: getUsername(),
                        is_offline: isOffline,
                        mode: modePref,
                        location_filter: locationFilter,
                        country_filter: countryFilter,
                        language_filter: languageFilter,
                        distance_km: distanceKm
                    })
                });
                if (response.match_found || response.room_name) {
                    stopPolling();
                    window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || modePref}`;
                } else if (response.status === 'discovery_results') {
                    stopPolling();
                    setDiscoveryResults(response.results);
                } else if (response.status === 'offline_activated') {
                    stopPolling();
                    alert(response.message);
                } else if (response.status === 'no_results') {
                    stopPolling();
                    alert(response.message);
                }
            } catch {
                stopPolling();
            }
        };
        // Poll every 3s
        const p = setInterval(tryMatch, 3000);
        setPollRef(p);
    };

    const startPersonaMatch = async () => {
        setIsMatching(true);
        const intentText = "Persona Match";
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({
                    intent: intentText,
                    username: getUsername(),
                    is_offline: isOffline,
                    mode: modePref,
                    location_filter: locationFilter,
                    country_filter: countryFilter,
                    language_filter: languageFilter,
                    distance_km: distanceKm
                })
            });
            if (response.status === 'offline_activated') {
                setIsMatching(false);
                alert(response.message);
            } else if (response.match_found || response.room_name) {
                setIsMatching(false);
                window.location.href = `/chat/room?id=${response.room_name}&mode=${response.mode || modePref}`;
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
                body: JSON.stringify({
                    intent: intentText,
                    username: getUsername(),
                    is_offline: isOffline,
                    mode: modePref,
                    location_filter: locationFilter,
                    country_filter: countryFilter,
                    language_filter: languageFilter,
                    distance_km: distanceKm
                })
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
                body: JSON.stringify({
                    intent: intentText,
                    username: getUsername(),
                    is_offline: isOffline,
                    mode: modePref,
                    location_filter: locationFilter,
                    country_filter: countryFilter,
                    language_filter: languageFilter,
                    distance_km: distanceKm
                })
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



    return (
        <main className="min-h-screen relative bg-transparent text-slate-900 dark:text-white selection:bg-cyan-500/30 overflow-hidden transition-colors duration-300">



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
                                {!notif.isFriend && !notif.isPending && (
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
                                                await fetch('http://127.0.0.1:8000/api/matchmaking/notifications/', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ ids: [notif.id] }),
                                                });
                                                setChatNotifs(prev => prev.filter(n => n.id !== notif.id));
                                            } catch { }
                                        }}
                                        className="flex-1 py-2 text-center bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-purple-500 hover:text-white transition-colors"
                                    >
                                        ➕ Add Friend
                                    </button>
                                )}
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

            {/* ===== SEARCH RESULTS OVERLAY ===== */}
            {discoveryResults.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-start bg-black/95 backdrop-blur-2xl p-6 py-20 overflow-y-auto"
                >
                    <div className="w-full max-w-7xl">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h2 className="text-3xl font-black font-mono tracking-widest text-white uppercase italic">AI Search Results</h2>
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
                                                    fetch('http://127.0.0.1:8000/api/matchmaking/notify/', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            sender: getUsername(),
                                                            receiver: result.username,
                                                            room_name: `direct_${[getUsername(), result.username].sort().join('_')}`,
                                                        }),
                                                    }).catch(() => { });
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
                                                    } catch { }
                                                }}
                                                className={`flex items-center justify-center gap-2 py-3 border transition-all font-mono text-[10px] uppercase tracking-widest ${friendRequested.has(result.username)
                                                    ? 'bg-green-500/10 border-green-500/40 text-green-400 cursor-default'
                                                    : 'bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500 hover:text-white hover:border-purple-400'
                                                    }`}
                                            >
                                                <User className="w-4 h-4" />
                                                {friendRequested.has(result.username) ? 'Requested ✓' : 'Add Friend'}
                                            </button>
                                        </div>
                                        {/* Row 2: Voice + Video (only if video mode) */}
                                        {modePref === 'video' && (
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {[
                                                    { icon: Phone, mode: 'audio', label: 'Voice' },
                                                    { icon: Video, mode: 'video', label: 'Video' },
                                                ].map((btn) => {
                                                    const isOffline = !result.is_online;
                                                    const isRinging = ringingUsername === result.username;
                                                    return (
                                                        <button
                                                            key={btn.mode}
                                                            disabled={isOffline || isRinging}
                                                            onClick={async () => {
                                                                if (isOffline) return;
                                                                if (isRinging) {
                                                                    // User clicked again while ringing -> Cancel
                                                                    endCall();
                                                                    setRingingUsername(null);
                                                                    return;
                                                                }
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
                                                                        // Use CallProvider to start the call properly
                                                                        startCall(result.username, btn.mode as 'audio' | 'video', res.room_name);
                                                                    }
                                                                } catch { setRingingUsername(null); }
                                                            }}
                                                            className={`flex items-center justify-center gap-2 py-3 border transition-all font-mono text-[10px] uppercase tracking-widest ${isOffline
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
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Texture Layer */}
            <div className="bg-noise dark:opacity-5 opacity-20" />

            {/* Shared Header */}
            <Header />

            {/* Marquee Banner */}
            <div className="absolute top-32 w-[200%] -left-[50%] -rotate-2 overflow-hidden bg-cyan-100/50 dark:bg-cyan-900/10 border-y border-cyan-200 dark:border-cyan-500/20 py-3 z-0 flex pointer-events-none transition-colors">
                <div className="flex animate-marquee whitespace-nowrap">
                    {[...Array(8)].map((_, i) => (
                        <span key={i} className="text-xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 dark:from-cyan-400 dark:to-purple-400 mx-8 uppercase">
                            • AI Hub Active • Find Your Match • Connect Now
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
                            Your<br />Smart<br />Hub.
                        </h2>

                        <p className="text-lg md:text-xl text-slate-600 dark:text-gray-400 max-w-lg mb-12 font-mono leading-relaxed border-l-2 border-cyan-500/50 pl-6">
                            {username
                                ? <>Welcome back, <span className="text-cyan-400 font-bold">{username.toUpperCase()}</span>.<br />Describe your intent or connect instantly.</>
                                : <>Describe your intent. The AI Matchmaker finds the exact human.</>
                            }
                        </p>

                        {/* Online Count Badge */}
                        <div className="flex flex-wrap items-center gap-3 mb-10 font-mono text-sm">
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                                <span className="text-green-400 font-bold">{onlineCount}</span>
                                <span className="text-gray-500">people active now</span>
                            </div>
                            <span className="text-gray-600 text-xs">/ {totalUsers} total</span>

                            {/* Global Filters Panel */}
                            <div className="flex flex-wrap items-center gap-2 md:ml-4 p-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setIsOffline(!isOffline)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${isOffline ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-transparent text-gray-500 hover:text-white'}`}
                                >
                                    {isOffline ? 'Mode: Offline Search' : 'Mode: Live Match'}
                                </button>
                                <div className="w-px h-4 bg-white/10 mx-1" />
                                <button
                                    onClick={() => setModePref(modePref === 'chat' ? 'video' : 'chat')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${modePref === 'video' ? 'bg-cyan-500 text-black' : 'bg-transparent text-gray-500 hover:text-white'}`}
                                >
                                    {modePref === 'video' ? '📹 Video' : '💬 Text'}
                                </button>
                                <div className="w-px h-4 bg-white/10 mx-1" />
                                {/* Premium Collapsible Filters */}
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all border ${showFilters ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-transparent border-white/10 text-gray-500 hover:text-white hover:border-white/30'}`}
                                >
                                    🌐 Filters
                                    {(countryFilter.length > 0 || languageFilter.length > 0 || distanceKm > 0) && (
                                        <span className="w-4 h-4 rounded-full bg-cyan-500 text-black text-[8px] font-black flex items-center justify-center">
                                            {[countryFilter.length > 0, languageFilter.length > 0, distanceKm > 0].filter(Boolean).length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Expanded Filter Drawer */}
                            {showFilters && (
                                <div className="w-full mt-2 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl flex flex-wrap gap-4 items-end">
                                    {/* Country Filter (Multi) */}
                                    <div className="flex flex-col gap-2 min-w-[300px] max-w-md">
                                        <label className="text-[9px] font-mono text-purple-400 uppercase tracking-widest flex justify-between">
                                            Countries <span>{countryFilter.length > 0 && `(${countryFilter.length} selected)`}</span>
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 border border-white/5 rounded-lg max-h-32 overflow-y-auto custom-scrollbar">
                                            {[
                                                { id: 'US', label: '🇺🇸 US' }, { id: 'IN', label: '🇮🇳 IN' }, { id: 'GB', label: '🇬🇧 UK' },
                                                { id: 'CA', label: '🇨🇦 CA' }, { id: 'AU', label: '🇦🇺 AU' }, { id: 'DE', label: '🇩🇪 DE' },
                                                { id: 'FR', label: '🇫🇷 FR' }, { id: 'BR', label: '🇧🇷 BR' }, { id: 'JP', label: '🇯🇵 JP' },
                                                { id: 'KR', label: '🇰🇷 KR' }, { id: 'CN', label: '🇨🇳 CN' }, { id: 'RU', label: '🇷🇺 RU' }
                                            ].map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setCountryFilter(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${countryFilter.includes(c.id) ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
                                                >
                                                    {c.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Language Filter (Multi) */}
                                    <div className="flex flex-col gap-2 min-w-[300px] max-w-md">
                                        <label className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest flex justify-between">
                                            Languages <span>{languageFilter.length > 0 && `(${languageFilter.length} selected)`}</span>
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 border border-white/5 rounded-lg max-h-32 overflow-y-auto custom-scrollbar">
                                            {[
                                                { id: 'en', label: '🌐 EN' }, { id: 'hi', label: '🇮🇳 HI' }, { id: 'es', label: '🇪🇸 ES' },
                                                { id: 'zh', label: '🇨🇳 ZH' }, { id: 'fr', label: '🇫🇷 FR' }, { id: 'de', label: '🇩🇪 DE' },
                                                { id: 'pt', label: '🇧🇷 PT' }, { id: 'ja', label: '🇯🇵 JA' }, { id: 'ru', label: '🇷🇺 RU' }
                                            ].map(l => (
                                                <button
                                                    key={l.id}
                                                    onClick={() => setLanguageFilter(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                                                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${languageFilter.includes(l.id) ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
                                                >
                                                    {l.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Distance Filter */}
                                    <div className="flex flex-col gap-1 min-w-[200px]">
                                        <label className="text-[9px] font-mono text-green-400 uppercase tracking-widest">
                                            Distance {distanceKm > 0 ? `— within ${distanceKm} km` : '— any'}
                                        </label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={500}
                                            step={25}
                                            value={distanceKm}
                                            onChange={(e) => setDistanceKm(Number(e.target.value))}
                                            className="w-full accent-green-400 cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[9px] font-mono text-gray-600">
                                            <span>Any</span><span>250km</span><span>500km</span>
                                        </div>
                                    </div>

                                    {/* Clear All */}
                                    <button
                                        onClick={() => { setCountryFilter([]); setLanguageFilter([]); setDistanceKm(0); }}
                                        className="text-[9px] font-mono text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors self-end pb-2"
                                    >
                                        ✕ Clear filters
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mode 1: Intent Matchmaking Section */}
                        <div className="w-full max-w-xl space-y-4 mb-10">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-cyan-400">01. Smart Search</h3>
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
                        <div className={`w-full max-w-xl space-y-4 ${isOffline ? 'opacity-20 cursor-not-allowed grayscale pointer-events-none' : ''}`}>
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="text-xl font-bold uppercase tracking-widest text-slate-800 dark:text-green-400">03. Roulette (M/F)</h3>
                                <div className="flex items-center gap-2">
                                    {isOffline && <span className="text-[9px] font-black text-amber-500 animate-pulse uppercase">[ LIVE ONLY ]</span>}
                                    <span className="text-[10px] font-mono text-slate-500 mr-2 border border-slate-500/30 px-2 py-0.5">Strict Male/Female</span>
                                </div>
                            </div>
                            <div className={`grid ${modePref === 'video' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => startOmegleMatch('chat')}
                                    disabled={isMatching || isOffline}
                                    className={`w-full py-4 bg-transparent text-slate-800 dark:text-white font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-300 dark:border-white/20 hover:bg-white/10 font-mono text-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <MessageSquare className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                                    Text Chat
                                </motion.button>

                                {modePref === 'video' && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => startOmegleMatch('video')}
                                        disabled={isMatching || isOffline}
                                        className={`w-full py-4 bg-green-500/10 text-slate-800 dark:text-green-400 font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-green-500/40 hover:bg-green-500/20 font-mono text-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        <Video className="w-4 h-4 text-green-500" />
                                        Video Chat
                                    </motion.button>
                                )}
                            </div>
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
                                    <span className="font-mono text-xs text-slate-500 dark:text-purple-400 uppercase">ACTIVE PROFILE</span>
                                </div>
                                <span className="text-xs font-mono text-purple-600 dark:text-purple-300">02</span>
                            </div>
                            <h3 className="text-2xl font-black mb-2 text-purple-900 dark:text-purple-100 uppercase tracking-wider">
                                {username ? username.toUpperCase() : 'YOUR PROFILE'}
                            </h3>
                            <p className="text-sm text-purple-700/80 dark:text-purple-200/70 font-mono leading-relaxed">User identity synced. Ready for profile-based blind matching.</p>
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
