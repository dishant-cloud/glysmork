"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, UserPlus, Phone, Video, VideoOff, Check, AlertTriangle, Fingerprint, Activity, Terminal } from 'lucide-react';
import Logo from '@/components/Logo';
import { fetchApi } from '@/lib/api';
import Peer from 'simple-peer';

interface ChatMessage {
    id: number;
    sender: string;
    text: string;
    isRead: boolean;
    deletedForEveryone: boolean;
    timestamp?: string;
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

    // Video State
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const myVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Initial State & Back Button Interception
    useEffect(() => {
        window.history.pushState(null, '', window.location.href);
        const handlePopState = (e: PopStateEvent) => {
            window.history.pushState(null, '', window.location.href);
            setShowExitModal(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

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
            if (data.friends.includes(partner)) setFriendStatus('accepted');
            else if (data.sent.includes(partner)) setFriendStatus('pending');
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
                setShowToast(`Neural Link Request Sent to ${partnerUsername}`);
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
            setMessages(data);
        } catch {}
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
                        if (prev.some(m => m.id === data.id)) return prev;
                        return [...prev, {
                            id: data.id || Date.now(),
                            sender: data.username,
                            text: data.message,
                            isRead: data.isRead || false,
                            deletedForEveryone: data.deletedForEveryone || false,
                            timestamp: data.timestamp
                        }];
                    });
                } else if (data.type === 'analysis_alert') {
                    setAlert({
                        username: data.username,
                        reason: data.reason,
                        image_url: data.image_url
                    });
                } else if (data.type === 'video_signal') {
                    if (data.signal.type === 'offer') {
                        handleReceiveOffer(data.signal);
                    } else if (peerRef.current) {
                        peerRef.current.signal(data.signal);
                    }
                } else if (data.type === 'force_exit') {
                    if (!roomId.startsWith('direct_')) {
                        window.location.replace('/dashboard?exit=partner');
                    } else {
                        if (peerRef.current) {
                            peerRef.current.destroy();
                            peerRef.current = null;
                        }
                        setIsVideoActive(false);
                        if (stream) stream.getTracks().forEach(track => track.stop());
                        setStream(null);
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
                if (Array.isArray(res)) setMessages(res);
            } catch (e) {}
        }, 3000);

        return () => {
            if (wsRef.current) wsRef.current.close();
            clearInterval(pollInt);
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [roomId, currentUser, stream, fetchMessages]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if ((mode === 'video' || mode === 'voice') && !isVideoActive && partnerUsername) {
            const timer = setTimeout(() => {
                toggleVideo();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [partnerUsername]);

    const performExit = async () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'force_exit' }));
        }
        try {
            await fetchApi(`/room/${roomId}/close/`, { method: 'POST' });
        } catch (e) { }
        setTimeout(() => {
            window.location.replace('/dashboard');
        }, 150);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim() || !roomId) return;
        const text = inputText;
        setInputText('');

        try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'chat_message',
                    message: text,
                    username: currentUser
                }));
            }
            await fetchApi(`/room/${roomId}/messages/`, {
                method: 'POST',
                body: JSON.stringify({ text, username: currentUser })
            });
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    // --- WebRTC Video/Voice Logic ---
    const toggleVideo = async (forceMode?: 'video' | 'voice') => {
        if (isVideoActive) {
            if (stream) stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsVideoActive(false);
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        } else {
            try {
                const params = new URLSearchParams(window.location.search);
                const mode = forceMode || params.get('mode') || 'video';
                const constraints = { video: mode === 'video', audio: true };
                const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                setStream(currentStream);
                setIsVideoActive(true);

                if (myVideoRef.current && mode === 'video') {
                    myVideoRef.current.srcObject = currentStream;
                }

                const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });
                peer.on('signal', (signal: any) => {
                    if (wsRef.current) {
                        wsRef.current.send(JSON.stringify({ type: 'video_signal', signal: signal }));
                    }
                });
                peer.on('stream', (remoteStream: MediaStream) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;
                    }
                });
                peerRef.current = peer;
            } catch (err) {
                window.alert("Camera/Mic access denied.");
            }
        }
    };

    const handleReceiveOffer = async (incomingSignal: any) => {
        try {
            const params = new URLSearchParams(window.location.search);
            const mode = params.get('mode') || 'video';
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: mode === 'video', audio: true });
            setStream(currentStream);
            setIsVideoActive(true);

            if (myVideoRef.current && mode === 'video') {
                myVideoRef.current.srcObject = currentStream;
            }

            const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });
            peer.on('signal', (signal: any) => {
                if (wsRef.current) {
                    wsRef.current.send(JSON.stringify({ type: 'video_signal', signal: signal }));
                }
            });
            peer.on('stream', (remoteStream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            });

            peer.signal(incomingSignal);
            peerRef.current = peer;
        } catch (err) {}
    };

    return (
        <div className="flex flex-col h-screen bg-[#020205] text-cyan-50 font-sans transition-colors duration-300 overflow-hidden relative">
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
                            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Neural Warning</h2>
                            <p className="text-red-200 mb-6 font-mono text-sm border-l-2 border-red-500 pl-4 text-left">
                                The AI Connection Engine has detected highly suspicious, manipulative, or deceptive intent originating from <strong>{alert.username}</strong>.
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
                                    AI Visual Perception of Node Intent
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
                    {/* HUD Data */}
                    <div className="font-mono text-[9px] text-cyan-500/70 tracking-[0.2em] uppercase hidden lg:flex flex-col gap-1 border-r border-cyan-900/50 pr-6">
                        <span className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                            SYS.V.1.0.4 [STABLE]
                        </span>
                        <span className="text-emerald-400 flex items-center gap-1.5 glow-text-emerald">
                            UPLINK: ESTABLISHED
                        </span>
                    </div>

                    {/* Partner Info */}
                    <div className="flex items-center gap-4 lg:pl-4 relative">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-lg animate-pulse"></div>
                            <div className="w-12 h-12 rounded-lg bg-black/80 border border-purple-500/50 flex items-center justify-center text-purple-400 font-bold text-lg shrink-0 shadow-[inset_0_0_10px_rgba(168,85,247,0.3)] relative z-10 font-mono">
                                {partnerUsername?.[0]?.toUpperCase() ?? '?'}
                            </div>
                        </div>
                        
                        <div>
                            <h2 className="font-bold text-cyan-50 flex flex-col">
                                {partnerUsername ? (
                                    <>
                                        <span className="text-purple-400 font-mono uppercase tracking-widest text-lg drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] flex items-center gap-2">
                                            {partnerUsername}
                                            <span className="px-1.5 py-0.5 rounded text-[8px] bg-purple-900/50 border border-purple-500/50 text-purple-200">NODE</span>
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-cyan-500/50 font-mono text-sm tracking-widest animate-pulse">SYNCING_NODE...</span>
                                )}
                            </h2>
                            <p className="text-[10px] text-cyan-500/60 font-mono uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <Fingerprint className="w-3 h-3" />
                                LOCAL_AUTH: <span className="text-cyan-400">{currentUser || '...'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {partnerUsername && (
                        <button
                            onClick={handleAddFriend}
                            disabled={friendStatus !== 'none'}
                            className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-mono tracking-widest uppercase border backdrop-blur-md ${
                                friendStatus === 'accepted'
                                ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                : friendStatus === 'pending'
                                    ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400 opacity-70'
                                    : 'bg-black/40 border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 hover:bg-emerald-900/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                }`}
                        >
                            {friendStatus === 'accepted' ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            <span>{friendStatus === 'accepted' ? 'LINKED' : friendStatus === 'pending' ? 'REQUESTED' : 'INITIATE_LINK'}</span>
                        </button>
                    )}
                    
                    <button
                        onClick={() => toggleVideo()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-mono tracking-widest uppercase shadow-lg border backdrop-blur-md ${
                            isVideoActive
                            ? 'bg-red-900/40 hover:bg-red-800/60 text-red-100 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                            : 'bg-purple-900/40 hover:bg-purple-800/60 text-cyan-50 border-purple-500/60 hover:border-purple-400 shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]'
                            }`}
                        title="Toggle Video Link"
                    >
                        {isVideoActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isVideoActive ? 'SEVER_VISUAL' : 'ESTABLISH_VISUAL'}</span>
                    </button>
                    
                    <button
                        onClick={() => setShowExitModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-mono tracking-widest bg-black/50 hover:bg-red-950/40 text-red-500 border border-red-900/50 hover:border-red-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        title="Disconnect from Node"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline uppercase">DISCONNECT</span>
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
                            <h3 className="text-xl font-bold font-mono tracking-widest uppercase mb-2 text-red-100">Terminate Link?</h3>
                            <p className="text-red-400/70 text-xs mb-8 font-mono leading-relaxed">
                                SEVERING THIS CONNECTION WILL DISSOLVE THE CURRENT SESSION AND REDIRECT BOTH NODES TO MAINFRAME.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={performExit}
                                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-mono font-bold rounded-xl transition-all uppercase tracking-[0.2em] text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                >
                                    CONFIRM_SEVERANCE
                                </button>
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="w-full py-3 bg-black hover:bg-slate-900 text-slate-400 font-mono font-bold rounded-xl transition-all uppercase tracking-[0.2em] text-xs border border-slate-800 hover:border-slate-600"
                                >
                                    MAINTAIN_CONNECTION
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Video Streams Container */}
            <AnimatePresence>
                {isVideoActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 220, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full shrink-0 flex items-center justify-center gap-8 overflow-hidden border-b border-cyan-900/30 bg-black/60 backdrop-blur-sm relative"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                        
                        {/* Remote Video */}
                        <div className="relative w-72 h-44 bg-slate-900 rounded-xl overflow-hidden border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 border border-purple-500/20 rounded-xl pointer-events-none" />
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-mono text-white/70 uppercase tracking-widest">REC</span>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 flex items-end">
                                <span className="text-xs font-mono text-purple-300 tracking-widest uppercase drop-shadow-[0_0_5px_rgba(168,85,247,0.8)] flex items-center gap-2">
                                    <Terminal className="w-3 h-3" />
                                    {partnerUsername || 'NODE_UNKNOWN'}
                                </span>
                            </div>
                        </div>

                        {/* Local Video */}
                        <div className="relative w-48 h-32 bg-slate-900 rounded-xl overflow-hidden border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                            <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror grayscale-[20%]" />
                            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 flex items-end">
                                <span className="text-[10px] font-mono text-cyan-300 tracking-widest uppercase drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]">
                                    LOCAL_FEED
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar relative z-10">
                <div className="text-center my-8 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                    <span className="relative px-4 py-1 text-[10px] rounded-sm bg-[#0a0a1a] text-cyan-500/80 font-mono border border-cyan-900/50 tracking-[0.2em] uppercase shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                        ENCRYPTED_LINK_ESTABLISHED
                    </span>
                </div>

                <AnimatePresence>
                    {messages.map((msg, index) => {
                        const isMe = currentUser ? msg.sender === currentUser : false;

                        return (
                            <motion.div
                                key={msg.id || index}
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                layout
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group w-full`}
                            >
                                <div className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    
                                    {/* Connection Node Dot */}
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
                                            <p className="text-[10px] font-mono text-purple-400 tracking-[0.1em] mb-2 uppercase border-b border-purple-900/30 pb-1 inline-block">
                                                {msg.sender} // {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LIVE'}
                                            </p>
                                        )}
                                        {isMe && (
                                           <p className="text-[10px] font-mono text-cyan-500/50 tracking-[0.1em] mb-1 uppercase text-right">
                                               {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LIVE'}
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
                <div className="max-w-4xl mx-auto">
                    <div className="relative flex items-center rounded-xl w-full bg-black/60 border border-slate-700/50 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all duration-300 p-1">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="INITIALIZE DATA TRANSMISSION..."
                            className="w-full bg-transparent py-4 pl-6 pr-16 text-cyan-50 focus:outline-none placeholder-slate-600 font-mono text-sm tracking-widest uppercase"
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
                        <p className="flex items-center gap-2 text-[9px] text-emerald-500/70 font-mono uppercase tracking-[0.2em]">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]" />
                            A.I. Analysis explicitly monitors intent stream
                        </p>
                        <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest hidden sm:block">
                            E2E NEURAL ENCRYPTION ACTIVE
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
