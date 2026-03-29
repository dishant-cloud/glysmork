"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { Zap, Shuffle, ArrowUpRight, User, LogOut, AlertTriangle, MessageSquare, Phone, Video, Bell, Clock, Users } from 'lucide-react';
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
        <main className="min-h-screen relative bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] text-slate-900 overflow-hidden selection:bg-cyan-500/30 font-sans">

            {/* Sophisticated Ambient Glows */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
                <div className="absolute top-[5%] right-[5%] w-[600px] h-[600px] bg-white/60 blur-[120px] rounded-full mix-blend-overlay" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50/50 blur-[100px] rounded-full mix-blend-multiply" />
            </div>

            {/* Exit Notification Toast */}
            <AnimatePresence>
                {exitNotification && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-3 rounded-full font-semibold text-sm shadow-lg flex items-center gap-3"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        {exitNotification}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Notification Toasts */}
            <div className="fixed top-28 right-6 z-[60] flex flex-col gap-3 max-w-sm w-80">
                <AnimatePresence>
                    {chatNotifs.map((notif) => (
                        <motion.div
                            key={notif.id}
                            initial={{ x: 120, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 120, opacity: 0 }}
                            transition={{ type: 'spring', damping: 20 }}
                            className="bg-white border border-slate-200/50 rounded-2xl px-4 py-4 shadow-lg"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                                    {notif.sender.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-900 text-sm font-semibold truncate">{notif.sender}</p>
                                    <p className="text-slate-800 text-xs">wants to connect with you</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/messages/${notif.sender}`}
                                    className="flex-1 py-2 flex items-center justify-center gap-2 bg-slate-900 text-white font-semibold text-xs rounded-full hover:bg-slate-800 transition-colors"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" /> Reply
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
                                                await fetch('http://127.0.0.1:8000/api/matchmaking/notifications/', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ ids: [notif.id] }),
                                                });
                                                setChatNotifs(prev => prev.filter(n => n.id !== notif.id));
                                            } catch { }
                                        }}
                                        className="flex-1 py-2 flex items-center justify-center gap-2 bg-white/50 border border-slate-200/50 text-slate-800 font-semibold text-xs rounded-full hover:bg-white/60 transition-colors"
                                    >
                                        <Zap className="w-3.5 h-3.5" /> Add Friend
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Scanning Network Overlay */}
            {searchingIntent && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm"
                >
                    <div className="relative flex items-center justify-center mb-10">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="absolute rounded-full border border-slate-400/50/30"
                                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                                transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: 'easeOut' }}
                                style={{ width: 80, height: 80 }}
                            />
                        ))}
                        <div className="w-20 h-20 rounded-full border-2 border-t-sky-400 border-r-sky-300 border-b-sky-400 border-l-transparent animate-spin" />
                        <Zap className="absolute w-6 h-6 text-sky-400 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-wide text-slate-800 mb-3">Finding your match...</h2>
                    <p className="text-sm text-slate-500 mb-2 border-l-2 border-slate-300/50 pl-4 max-w-xs text-center">
                        {searchingIntent === 'Random Connection'
                            ? 'Waiting for someone special...'
                            : <>Looking for: <span className="text-slate-800 font-semibold">&quot;{searchingIntent}&quot;</span></>
                        }
                    </p>
                    <p className="text-xs text-slate-400 mb-10">Retrying every 3 seconds automatically</p>
                    <button
                        onClick={stopPolling}
                        className="px-8 py-3 border border-slate-300/50 text-slate-800 text-sm font-semibold hover:bg-white/50 transition-colors rounded-full"
                    >
                        Cancel Search
                    </button>
                </motion.div>
            )}

            {/* Search Results Overlay */}
            {discoveryResults.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-start bg-white p-6 py-20 overflow-y-auto"
                >
                    <div className="w-full max-w-7xl">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase" >
                                    Network Results
                                </h2>
                                <p className="text-slate-500 text-sm mt-2 font-medium">AI synthesized candidates for: &quot;{searchingIntent || intent}&quot;</p>
                            </div>
                            <button
                                onClick={() => setDiscoveryResults([])}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest border border-slate-200 rounded-2xl px-5 py-2.5 hover:bg-white transition-all shadow-sm"
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {discoveryResults.map((result, idx) => (
                                <motion.div
                                    key={result.username}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-white border border-slate-200/50 p-6 flex flex-col relative rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="absolute top-3 right-3">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-900 border border-slate-200 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                                            {result.score}% Compatibility
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                                {result.username.charAt(0).toUpperCase()}
                                            </div>
                                            {result.is_online && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white shadow-sm" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-slate-900 font-bold text-lg leading-none mb-1.5">{result.username}</h4>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${result.is_online ? 'text-green-600' : 'text-slate-400'}`}>
                                                {result.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {result.match_tags?.map((tag: string) => (
                                            <span key={tag} className="text-[10px] font-medium text-slate-800 border border-slate-200/50 bg-white/50 px-2 py-0.5 rounded-full">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>

                                    <p className="text-slate-500 text-sm mb-4 line-clamp-3 leading-relaxed border-l-2 border-slate-200/50 pl-3">
                                        {result.reason}
                                    </p>

                                    <div className="mb-4 grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[9px] font-semibold text-slate-400 uppercase block mb-1">Expertise</span>
                                            <div className="text-xs text-slate-600 truncate">{result.expertise?.join(', ') || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-semibold text-slate-400 uppercase block mb-1">Interests</span>
                                            <div className="text-xs text-slate-600 truncate">{result.interests?.join(', ') || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-sky-50 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => {
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
                                                className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white hover:bg-slate-900 transition-all font-semibold text-xs rounded-full"
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
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
                                                className={`flex items-center justify-center gap-2 py-2.5 border transition-all font-semibold text-xs rounded-full ${friendRequested.has(result.username)
                                                    ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                                                    : 'bg-white/50 border-slate-200/50 text-slate-800 hover:bg-white/60'
                                                    }`}
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                {friendRequested.has(result.username) ? 'Requested' : 'Connect'}
                                            </button>
                                        </div>
                                        {modePref === 'video' && (
                                            <div className="grid grid-cols-2 gap-2 mt-1">
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
                                                                if (isRinging) { endCall(); setRingingUsername(null); return; }
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
                                                                        startCall(result.username, btn.mode as 'audio' | 'video', res.room_name);
                                                                    }
                                                                } catch { setRingingUsername(null); }
                                                            }}
                                                            className={`flex items-center justify-center gap-2 py-2.5 border transition-all font-semibold text-xs rounded-full ${isOffline
                                                                ? 'opacity-30 cursor-not-allowed border-slate-200/50 text-slate-800'
                                                                : isRinging
                                                                    ? 'bg-white/60 text-slate-800 border-slate-300/50 animate-pulse'
                                                                    : 'bg-white border-slate-200/50 text-slate-800 hover:bg-slate-900 hover:text-white'
                                                                }`}
                                                            title={isOffline ? 'User offline' : btn.label}
                                                        >
                                                            <btn.icon className="w-3.5 h-3.5" />
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

            {/* Shared Header */}
            <Header />

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center px-6 md:px-12 pt-32 pb-20">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

                    {/* Left Col: Hero */}
                    <div className="lg:col-span-7 flex flex-col items-start">

                        {/* Subtitle label */}
                        <div className="flex items-center gap-2 mb-6 drop-shadow-sm">
                            <span className="text-slate-500 font-semibold text-[13px] tracking-widest uppercase">Welcome{username ? `, ${username}` : ''}</span>
                            <div className="h-px w-12 bg-slate-300" />
                        </div>

                        {/* Clean Hero Heading */}
                        <h1 className="text-[55px] md:text-[75px] leading-[0.95] font-semibold tracking-[-0.03em] text-slate-900 mb-6 drop-shadow-sm">
                            Glysmork
                        </h1>

                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-slate-800 uppercase leading-tight">
                            Find The<br />Right Person
                        </h2>

                        <p className="text-base text-slate-500 max-w-lg mb-10 leading-relaxed border-l-2 border-slate-300/50 pl-5">
                            {username
                                ? <><span className="text-slate-800 font-semibold">{username}</span> is here.<br />Describe your intent and our AI finds the right person for you.</>
                                : <>Describe the person you need. Our AI finds the right human — not random, not dating. Precise.</>
                            }
                        </p>

                        {/* Online count badge */}
                        <div className="flex flex-wrap items-center gap-3 mb-8">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/50 rounded-full shadow-sm">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                                <span className="text-green-600 font-bold text-sm">{onlineCount}</span>
                                <span className="text-slate-500 text-sm">online now</span>
                            </div>
                            <span className="text-slate-400 text-sm">/ {totalUsers} total members</span>
                        </div>

                        {/* Filter toggles */}
                        <div className="flex flex-wrap items-center gap-2 mb-8">
                            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200/50 rounded-full shadow-sm">
                                <button
                                    onClick={() => setIsOffline(!isOffline)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isOffline ? 'bg-amber-400 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    {isOffline ? 'Offline Search' : 'Live Match'}
                                </button>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => setModePref(modePref === 'chat' ? 'video' : 'chat')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${modePref === 'video' ? 'bg-slate-900 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-900'}`}
                                >
                                    {modePref === 'video' ? <Video className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                    {modePref === 'video' ? 'Video' : 'Chat'}
                                </button>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${showFilters ? 'bg-white border-slate-200 text-slate-900' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900'}`}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Filters
                                    {(countryFilter.length > 0 || languageFilter.length > 0 || distanceKm > 0) && (
                                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[8px] font-bold flex items-center justify-center">
                                            {[countryFilter.length > 0, languageFilter.length > 0, distanceKm > 0].filter(Boolean).length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Filter Drawer */}
                        {showFilters && (
                            <div className="w-full max-w-xl mb-8 p-5 bg-white border border-slate-200/50 rounded-2xl flex flex-wrap gap-4 items-end shadow-sm">
                                <div className="flex flex-col gap-2 min-w-[280px]">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Countries {countryFilter.length > 0 && `(${countryFilter.length})`}</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { id: 'US', label: 'US' }, { id: 'IN', label: 'IN' }, { id: 'GB', label: 'UK' },
                                            { id: 'CA', label: 'CA' }, { id: 'AU', label: 'AU' }, { id: 'DE', label: 'DE' },
                                            { id: 'FR', label: 'FR' }, { id: 'BR', label: 'BR' }, { id: 'JP', label: 'JP' },
                                        ].map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => setCountryFilter(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${countryFilter.includes(c.id) ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-900'}`}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 min-w-[280px]">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Languages {languageFilter.length > 0 && `(${languageFilter.length})`}</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { id: 'en', label: 'EN' }, { id: 'hi', label: 'HI' }, { id: 'es', label: 'ES' },
                                            { id: 'zh', label: 'ZH' }, { id: 'fr', label: 'FR' }, { id: 'de', label: 'DE' },
                                            { id: 'pt', label: 'PT' }, { id: 'ja', label: 'JA' }, { id: 'ru', label: 'RU' }
                                        ].map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => setLanguageFilter(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${languageFilter.includes(l.id) ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-900'}`}
                                            >
                                                {l.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 min-w-[200px]">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Distance {distanceKm > 0 ? `— within ${distanceKm} km` : '— any'}
                                    </label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={500}
                                        step={25}
                                        value={distanceKm}
                                        onChange={(e) => setDistanceKm(Number(e.target.value))}
                                        className="w-full accent-sky-500 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-400">
                                        <span>Any</span><span>250km</span><span>500km</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setCountryFilter([]); setLanguageFilter([]); setDistanceKm(0); }}
                                    className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors self-end pb-1 uppercase tracking-widest"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}

                        {/* Mode 1: Smart Search */}
                        <div className="w-full max-w-xl space-y-3 mb-8">
                            <h3 className="text-base font-bold uppercase tracking-widest text-slate-800">01. Smart Search</h3>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={intent}
                                    onChange={(e) => setIntent(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && startMatching()}
                                    placeholder="e.g. e.g. Backend dev who knows Python and system design..."
                                    className="flex-1 px-5 py-4 bg-white border border-slate-200/50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-slate-400/50 transition-all rounded-2xl shadow-sm"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => startMatching()}
                                    disabled={!intent.trim() || isMatching}
                                    className={`px-6 py-4 bg-slate-900 text-white font-bold flex items-center gap-2 transition-all rounded-2xl border border-slate-400/50 hover:bg-slate-900 shadow-sm ${!intent.trim() || isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    {isMatching ? '...' : <><ArrowUpRight className="w-5 h-5" /></>}
                                </motion.button>
                            </div>
                        </div>

                        {/* Mode 2: Persona Match */}
                        <div className="w-full max-w-xl space-y-3 mb-8">
                            <h3 className="text-base font-bold uppercase tracking-widest text-slate-800">02. Persona Match</h3>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={startPersonaMatch}
                                disabled={isMatching}
                                className={`w-full px-6 py-4 bg-white text-slate-800 font-semibold flex items-center justify-between transition-all border border-slate-200/50 hover:border-slate-400/50 hover:bg-white/50 rounded-2xl shadow-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <User className="w-5 h-5 text-slate-800" />
                                    <span className="text-sm">Match Based On My Profile</span>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-800" />
                            </motion.button>
                        </div>

                        {/* Mode 3: Roulette */}
                        <div className={`w-full max-w-xl space-y-3 ${isOffline ? 'opacity-20 cursor-not-allowed grayscale pointer-events-none' : ''}`}>
                            <div className="flex items-center gap-3">
                                <h3 className="text-base font-bold uppercase tracking-widest text-green-600">03. Roulette (M/F)</h3>
                                {isOffline && <span className="text-[9px] font-bold text-amber-500 animate-pulse uppercase">Live Only</span>}
                                <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">Strict Gender</span>
                            </div>
                            <div className={`grid ${modePref === 'video' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => startOmegleMatch('chat')}
                                    disabled={isMatching || isOffline}
                                    className={`w-full py-4 bg-white text-slate-700 font-semibold flex items-center justify-center gap-3 transition-all border border-slate-200 hover:border-slate-300/50 hover:bg-white/50 rounded-2xl text-sm shadow-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <MessageSquare className="w-4 h-4 text-slate-400" />
                                    Text Chat
                                </motion.button>
                                {modePref === 'video' && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => startOmegleMatch('video')}
                                        disabled={isMatching || isOffline}
                                        className={`w-full py-4 bg-white text-green-700 font-semibold flex items-center justify-center gap-3 transition-all border border-green-200 hover:bg-green-50 rounded-2xl text-sm shadow-sm ${isMatching ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        <Video className="w-4 h-4 text-green-500" />
                                        Video Chat
                                    </motion.button>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Col: Floating Feature Cards */}
                    <div className="lg:col-span-5 relative mt-16 lg:mt-0 h-[600px] w-full hidden md:block">

                        {/* Ambient glow behind right column */}
                        <div className="absolute top-[50%] left-[50%] w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-white/40 blur-[100px] rounded-full mix-blend-overlay pointer-events-none z-0" />

                        {/* Card 2 — Main Central Card (Your Profile) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="absolute z-10 w-[360px] bg-white/80 backdrop-blur-2xl border border-white p-8 rounded-[36px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] right-10 top-1/2 -translate-y-[60%]"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                    <span className="font-semibold text-xs text-slate-600 uppercase tracking-widest">Active Status</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-400 tracking-wider">02</span>
                            </div>
                            <h3 className="text-[26px] font-semibold mb-3 text-slate-800 tracking-[-0.03em] uppercase">
                                {username ? username : 'PROFILE'}
                            </h3>
                            <p className="text-[14px] text-slate-500 font-medium leading-relaxed">System synced. Ready for AI-powered networking.</p>
                        </motion.div>

                        {/* Card 1 — Top Left Overlapping Card (Intent Engine) */}
                        <motion.div
                            initial={{ opacity: 0, x: -30, y: -30 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="absolute z-20 top-[6%] left-[0%] w-[300px] bg-[#fdfdfc]/90 backdrop-blur-xl border border-white/80 p-6 rounded-[28px] shadow-[0_25px_50px_-15px_rgba(0,0,0,0.1)]"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100">
                                    <Zap className="text-cyan-500 w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">01</span>
                            </div>
                            <h3 className="text-[18px] font-semibold mb-2 text-slate-800 tracking-tight">Intent Engine</h3>
                            <p className="text-[13px] text-slate-500 font-medium leading-relaxed">AI searches thousands of robust profiles to find your ideal match.</p>
                        </motion.div>

                        {/* Card 3 — Bottom Right Overlapping (Roulette) */}
                        <motion.div
                            initial={{ opacity: 0, x: 30, y: 30 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="absolute z-20 bottom-[15%] right-[-5%] w-[290px] bg-white/90 backdrop-blur-xl border border-white/80 p-6 rounded-[28px] shadow-[0_25px_50px_-15px_rgba(0,0,0,0.1)]"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center border border-green-100">
                                    <Video className="text-green-500 w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">03</span>
                            </div>
                            <h3 className="text-[18px] font-semibold mb-2 text-slate-800 tracking-tight">Global Roulette</h3>
                            <p className="text-[13px] text-slate-500 font-medium leading-relaxed">Strict parameters applied. Instant video integration.</p>
                        </motion.div>

                    </div>

                </div>
            </div>
        </main>
    );
}
