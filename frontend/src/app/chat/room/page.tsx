"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, UserPlus, Phone, Video, VideoOff, Check, AlertTriangle, Fingerprint, Activity, Terminal, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import { useCall } from '@/components/CallProvider';
import { fetchApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface ChatMessage {
    id: number;
    sender: string;
    text: string;
    isRead: boolean;
    deletedForEveryone: boolean;
    timestamp?: string;
    client_id?: string;
    is_call_log?: boolean;
    call_mode?: 'audio' | 'video';
    call_status?: 'ended' | 'declined' | 'no_answer' | 'unavailable' | 'cancelled';
    call_duration?: number;
}

interface AnalysisAlert {
    username: string;
    reason: string;
    image_url: string;
}

export default function ChatRoom() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
    const [alert, setAlert] = useState<AnalysisAlert | null>(null);
    const [showExitModal, setShowExitModal] = useState(false);
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
    const [showToast, setShowToast] = useState<string | null>(null);

    const { startCall, endCall } = useCall();
    const router = useRouter();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Back Button: always go to /messages
    useEffect(() => {
        const handlePopState = () => {
            if (roomId?.startsWith('session_')) {
                // Ephemeral session: show exit modal instead of going back silently
                window.history.pushState(null, '', window.location.href);
                setShowExitModal(true);
            } else {
                // Direct/friend chat: go back to inbox
                router.push('/messages');
            }
        };

        // Ensure navigating back from session rooms shows modal
        if (roomId?.startsWith('session_')) {
            window.history.pushState(null, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [roomId, router]);

    // Initialize Room Data
    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) {
            window.location.href = '/login';
            return;
        }
        const me = u ? JSON.parse(u).username : null;
        if (me) setCurrentUser(me);

        const params = new URLSearchParams(window.location.search);
        const rm = params.get('id');
        if (rm) {
            setRoomId(rm);
            fetchApi(`/room/${rm}/status/`)
                .then(statusRes => {
                    if (statusRes.is_active === false && !rm.startsWith('direct_')) {
                        window.location.replace('/dashboard?exit=partner');
                    }
                })
                .catch(() => { });

            fetch(`http://127.0.0.1:8000/api/room/${rm}/`)
                .then(r => r.json())
                .then(data => {
                    if (data.users) {
                        const partner = data.users.find((u: string) => u !== me);
                        setPartnerUsername(partner || null);
                        if (partner) checkFriendship(me, partner);
                    }
                })
                .catch(() => { });
        }
    }, []);

    const checkFriendship = async (me: string, partner: string) => {
        try {
            const data = await fetchApi(`/matchmaking/friends/?username=${encodeURIComponent(me)}`);
            const isFriend = data.friends?.some((f: any) => (f.username === partner || f === partner));
            const isPending = data.sent?.some((f: any) => (f.username === partner || f === partner));
            
            if (isFriend) setFriendStatus('accepted');
            else if (isPending) setFriendStatus('pending');
        } catch (e) { console.error(e); }
    };

    const handleAddFriend = async () => {
        if (!currentUser || !partnerUsername) return;
        try {
            const res = await fetchApi('/matchmaking/friends/', {
                method: 'POST',
                body: JSON.stringify({
                    username: currentUser,
                    target_username: partnerUsername,
                    action: 'request'
                })
            });
            if (res.status === 'requested') {
                setFriendStatus('pending');
                setShowToast(`Friend Request Sent to ${partnerUsername}`);
                setTimeout(() => setShowToast(null), 3000);
            }
        } catch (e) {
            console.error(e);
            setShowToast("Synchronization Error");
            setTimeout(() => setShowToast(null), 3000);
        }
    };

    const fetchMessages = useCallback(async () => {
        if (!roomId || !currentUser) return;
        try {
            const data = await fetchApi(`/room/${roomId}/messages/?username=${encodeURIComponent(currentUser)}`);
            setMessages(Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []));
        } catch { }
    }, [roomId, currentUser]);

    // WebSocket and initial fetch setup
    useEffect(() => {
        if (!roomId || !currentUser) return;
        fetchMessages();
        const pollInterval = setInterval(fetchMessages, 3000);

        try {
            const token = localStorage.getItem('access_token');
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).host : '127.0.0.1:8000';
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/chat/${roomId}/?token=${token}`);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'chat_message') {
                    setMessages(prev => {
                        if (data.id && prev.some(m => m.id === data.id)) return prev;
                        if (data.client_id && prev.some(m => m.client_id === data.client_id)) {
                            // Update the existing optimistic message with the real DB ID if available
                            return prev.map(m => m.client_id === data.client_id ? { ...m, id: data.id ?? m.id } : m);
                        }
                        
                        return [...prev, {
                            id: data.id ?? (Date.now() + Math.random()),
                            client_id: data.client_id,
                            sender: data.username || data.sender, // Caller logs use sender
                            text: data.message || data.text || "",
                            isRead: data.isRead || false,
                            deletedForEveryone: data.deletedForEveryone || false,
                            timestamp: data.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            is_call_log: data.is_call_log,
                            call_mode: data.call_mode,
                            call_status: data.call_status,
                            call_duration: data.call_duration,
                        }];
                    });
                } else if (data.type === 'analysis_alert') {
                    setAlert({
                        username: data.username,
                        reason: data.reason,
                        image_url: data.image_url
                    });
                } else if (data.type === 'force_exit') {
                    if (!roomId.startsWith('direct_')) {
                        window.location.replace('/dashboard?exit=partner');
                    }
                } else if (data.type === 'user_left') {
                    window.location.replace('/dashboard?exit=partner');
                }
            };
        } catch (e) {
            console.log("WebSocket failed", e);
        }

        const pollInt = setInterval(async () => {
            try {
                const statusRes = await fetchApi(`/room/${roomId}/status/`);
                if (statusRes.is_active === false && !roomId.startsWith('direct_')) {
                    window.location.replace('/dashboard?exit=partner');
                    return;
                }
                const res = await fetchApi(`/room/${roomId}/messages/?username=${encodeURIComponent(currentUser || '')}`);
                if (res && Array.isArray(res.results)) setMessages(res.results);
                else if (Array.isArray(res)) setMessages(res);
            } catch (e) { }
        }, 3000);

        return () => {
            if (wsRef.current) wsRef.current.close();
            clearInterval(pollInt);
            // End call if it's a session room being closed
            if (roomId?.startsWith('session_')) {
                endCall();
            }
        };
    }, [roomId, currentUser, fetchMessages, endCall]);



    const performExit = async () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'force_exit' }));
        }
        try {
            // End WebRTC call if active
            endCall();
            await fetchApi(`/room/${roomId}/close/`, { method: 'POST' });
        } catch (e) { }
        setTimeout(() => {
            window.location.replace('/dashboard');
        }, 150);
    };

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim() || !roomId) return;
        const text = inputText;
        setInputText('');

        const clientId = crypto.randomUUID();

        // Optimistic update
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), {
            id: Date.now() + Math.random(), // Temp ID
            client_id: clientId,
            sender: currentUser || 'User',
            text: text,
            isRead: false,
            deletedForEveryone: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'chat_message',
                    message: text,
                    username: currentUser,
                    client_id: clientId
                }));
            }
            await fetchApi(`/room/${roomId}/messages/`, {
                method: 'POST',
                body: JSON.stringify({ text, username: currentUser, client_id: clientId })
            });
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#020205] text-cyan-50 font-sans transition-colors duration-300 overflow-hidden z-[50]">
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 bg-noise z-0" />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
                className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[url('/glysmork_signup.png')] bg-cover opacity-5 mix-blend-screen pointer-events-none"
            />

            {/* Toast Notification */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-emerald-500/90 text-black font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-400 rounded-lg backdrop-blur-md"
                    >
                        {showToast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Alert Modal Overlay */}
            <AnimatePresence>
                {alert && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-8 max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.5)] flex flex-col items-center text-center"
                        >
                            <AlertTriangle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
                            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">AI Safety Warning</h2>
                            <p className="text-red-200 mb-6 font-mono text-sm border-l-2 border-red-500 pl-4 text-left">
                                Our AI Safety System has detected suspicious or manipulative behavior originating from <strong>{alert.username}</strong>.
                                <br /><br />
                                <em className="text-red-400">Reason: {alert.reason}</em>
                            </p>
                            <div className="w-full relative mb-8 overflow-hidden rounded-xl border border-red-500/50 group">
                                <img
                                    src={alert.image_url}
                                    alt="AI Perception of Fraudster"
                                    className="w-full h-auto object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 transition-all duration-1000"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs font-mono text-red-400 uppercase">
                                    AI Visual Perception of User Intent
                                </div>
                            </div>
                            <button
                                onClick={() => setAlert(null)}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest transition-colors rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                            >
                                Acknowledge & Proceed with Caution
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header: Cyberpunk Glass Navbar */}
            <header className="h-20 ultra-glass border-b border-cyan-900/40 flex items-center justify-between px-6 z-20 shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-6">
                    {/* Back Button */}
                    <button 
                        onClick={() => {
                            if (roomId?.startsWith('session_')) {
                                setShowExitModal(true);
                            } else {
                                window.location.replace('/dashboard');
                            }
                        }}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block"
                        title="Return to Dashboard"
                    >
                        <ArrowLeft className="w-5 h-5 text-cyan-500" />
                    </button>
                    
                    {/* HUD Data */}
                    <div className="text-[10px] text-cyan-500/50 font-medium tracking-tight hidden lg:flex flex-col gap-1 border-x border-cyan-900/30 px-6">
                        <span className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-emerald-400/80 animate-pulse" />
                            NETWORK STATUS: STABLE
                        </span>
                        <span className="text-emerald-400/70 flex items-center gap-1.5 font-bold uppercase text-[9px]">
                            SECURE CHANNEL
                        </span>
                    </div>

                    {/* Partner Info */}
                    <div className="flex items-center gap-4 lg:pl-4 relative">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-xl animate-pulse"></div>
                            <div className="w-12 h-12 rounded-xl bg-black/80 border border-purple-500/50 flex items-center justify-center text-purple-400 font-bold text-xl shrink-0 shadow-[inset_0_0_15px_rgba(168,85,247,0.3)] relative z-10">
                                {partnerUsername?.[0]?.toUpperCase() ?? '?'}
                            </div>
                        </div>

                        <div>
                            <h2 className="font-bold text-cyan-50 flex flex-col">
                                {partnerUsername ? (
                                    <>
                                        <span className="text-purple-400 tracking-tight text-xl drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] flex items-center gap-2">
                                            {partnerUsername}
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-900/50 border border-purple-500/50 text-purple-200">ACTIVE</span>
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-cyan-500/50 text-sm tracking-wide animate-pulse italic">Connecting...</span>
                                )}
                            </h2>
                            <p className="text-xs text-cyan-400/60 font-medium mt-0.5 flex items-center gap-1">
                                <Fingerprint className="w-3 h-3" />
                                Identified as <span className="text-cyan-400 font-bold">{currentUser || '...'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {/* Always show Link option if we have a partner, even in Roulette */}
                    {partnerUsername && (
                        <button
                            onClick={handleAddFriend}
                            disabled={friendStatus !== 'none'}
                            className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-bold tracking-tight border backdrop-blur-md ${friendStatus === 'accepted'
                                    ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                    : friendStatus === 'pending'
                                        ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400 opacity-70'
                                        : 'bg-black/40 border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 hover:bg-emerald-900/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                }`}
                        >
                            {friendStatus === 'accepted' ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            <span>{friendStatus === 'accepted' ? 'Friends' : friendStatus === 'pending' ? 'Requested' : 'Add Friend'}</span>
                        </button>
                    )}

                    {/* ONLY show Calls for Direct/Friend Chats */}
                    {roomId?.startsWith('direct_') && (
                        <>
                            <button
                                onClick={() => {
                                    if (partnerUsername) startCall(partnerUsername, 'video', roomId || undefined);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-bold tracking-tight shadow-lg border backdrop-blur-md bg-purple-900/40 hover:bg-purple-800/60 text-cyan-50 border-purple-500/60 hover:border-purple-400 shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]"
                                title="Video Call"
                            >
                                <Video className="w-4 h-4" />
                                <span className="hidden sm:inline">Video Call</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (partnerUsername) startCall(partnerUsername, 'audio', roomId || undefined);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-bold tracking-tight shadow-lg border backdrop-blur-md bg-white/5 hover:bg-white/10 text-cyan-50 border-white/10 hover:border-white/20 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]"
                                title="Audio Call"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="hidden sm:inline">Audio Call</span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setShowExitModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-bold tracking-tight bg-red-950/20 hover:bg-red-950/50 text-red-500 border border-red-900/30 hover:border-red-500/50 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                        title="Leave Chat"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Leave Chat</span>
                    </button>
                </div>
            </header>

            {/* Exit Confirmation Modal */}
            <AnimatePresence>
                {showExitModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-[#050511] border border-red-500/50 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.2)] text-center relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />
                            <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                                <LogOut className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight mb-2 text-white">Leave the chat?</h3>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                                You are about to end this session. All local history for this match will be lost.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={performExit}
                                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all tracking-tight text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                >
                                    End Session
                                </button>
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-2xl transition-all tracking-tight text-sm border border-white/10"
                                >
                                    Stay Here
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages Area */}
            <main ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 md:p-8 space-y-6 custom-scrollbar relative z-10 overscroll-contain">
                <div className="text-center my-8 relative flex-shrink-0">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
                    <span className="relative px-6 py-1.5 rounded-full bg-[#0a0a1a] text-cyan-400/80 text-[11px] font-bold border border-cyan-900/30 tracking-wide shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                        Secure Connection Established
                    </span>
                </div>

                <AnimatePresence>
                    {messages.map((msg, index) => {
                        const isMe = currentUser ? msg.sender === currentUser : false;

                        if (msg.is_call_log) {
                            const Icon = msg.call_mode === 'video' ? Video : Phone;
                            const statusColor = msg.call_status === 'ended' ? 'text-emerald-400' : 'text-red-400';
                            const durationDisp = msg.call_duration ? `${Math.floor(msg.call_duration/60)}:${(msg.call_duration%60).toString().padStart(2, '0')}` : '';
                            
                            return (
                                <motion.div key={msg.id || index} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} layout className="flex justify-center w-full my-4">
                                    <div className="bg-black/40 border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-3 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                                        <div className={`p-2 rounded-full bg-white/5 ${statusColor} shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white tracking-tight">
                                                {msg.call_mode === 'video' ? 'Video' : 'Audio'} call {msg.call_status}
                                            </span>
                                            <span className="text-[10px] text-cyan-500/50 font-medium flex items-center gap-2">
                                                {msg.timestamp} {durationDisp && `• ${durationDisp}`}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={msg.id || index}
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                layout
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group w-full`}
                            >
                                <div className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                                    {/* User Activity Dot */}
                                    <div className="hidden sm:flex flex-col items-center justify-end pb-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isMe ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-purple-400 shadow-[0_0_5px_#a855f7]'}`} />
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`relative px-5 py-4 shadow-xl backdrop-blur-md ${msg.deletedForEveryone
                                        ? 'bg-black/20 border border-slate-800 text-slate-600 italic rounded-xl'
                                        : isMe
                                            ? 'bg-gradient-to-br from-cyan-950/80 to-slate-900/80 text-cyan-50 border border-cyan-700/40 rounded-t-2xl rounded-bl-2xl rounded-br-sm'
                                            : 'bg-black/60 text-purple-50 border border-purple-900/40 rounded-t-2xl rounded-br-2xl rounded-bl-sm'
                                        }`}>

                                        {!isMe && (
                                            <p className="text-[10px] font-bold text-purple-400 tracking-tight mb-2 border-b border-purple-900/20 pb-1 inline-block">
                                                {msg.sender} • {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </p>
                                        )}
                                        {isMe && (
                                            <p className="text-[10px] font-bold text-cyan-500/50 tracking-tight mb-1 text-right">
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sent'}
                                            </p>
                                        )}

                                        <p className="leading-relaxed whitespace-pre-wrap text-[15px] md:text-base font-sans font-light tracking-wide">{msg.text}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-4" />
            </main>

            {/* Input Footer */}
            <footer className="p-4 md:p-6 lg:p-8 shrink-0 relative z-20 w-full bg-gradient-to-t from-black via-black/80 to-transparent">
                <div className="w-full">
                    <div className="relative flex items-center rounded-xl w-full bg-black/60 border border-slate-700/50 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all duration-300 p-1">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Type a message..."
                                className="w-full flex-1 bg-transparent py-4 pl-6 pr-16 text-cyan-50 focus:outline-none placeholder-slate-600 text-[15px] font-medium tracking-tight"
                            />
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim()}
                            className="absolute right-3 p-3 rounded-lg bg-cyan-900/40 hover:bg-cyan-800 border border-cyan-700/50 disabled:opacity-30 disabled:border-slate-800 disabled:bg-black transition-all flex items-center justify-center text-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                        >
                            <Send className={`w-4 h-4 ml-0.5 ${inputText.trim() ? 'animate-pulse' : ''}`} />
                        </button>
                    </div>
                    <div className="flex justify-between items-center mt-3 px-2">
                        <p className="flex items-center gap-2 text-[10px] text-emerald-500/50 font-medium">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]" />
                            AI Safety Monitoring Active
                        </p>
                        <p className="text-[10px] text-slate-600 font-medium hidden sm:block">
                            End-to-End Encryption
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
