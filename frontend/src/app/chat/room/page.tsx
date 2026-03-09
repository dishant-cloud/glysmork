"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MoreVertical, Trash2, Download, Check, CheckCheck, Video, VideoOff, AlertTriangle } from 'lucide-react';
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
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [alert, setAlert] = useState<AnalysisAlert | null>(null);

    // Video State
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const myVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Initialize Room Data
    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) {
            setCurrentUser(JSON.parse(u).username);
        }

        const params = new URLSearchParams(window.location.search);
        const rm = params.get('id');
        if (rm) {
            setRoomId(rm);
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        if (!roomId) return;
        try {
            const data = await fetchApi(`/room/${roomId}/messages/`);
            setMessages(data);
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    }, [roomId]);

    // WebSocket and initial fetch setup
    useEffect(() => {
        if (!roomId || !currentUser) return;

        fetchMessages();

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
                // Trigger the massive visual alert
                setAlert({
                    username: data.username,
                    reason: data.reason,
                    image_url: data.image_url
                });
            } else if (data.type === 'video_signal') {
                // Incoming WebRTC Signal
                if (data.signal.type === 'offer') {
                    handleReceiveOffer(data.signal);
                } else if (peerRef.current) {
                    peerRef.current.signal(data.signal);
                }
            }
        };

        return () => {
            ws.close();
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, currentUser, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim() || !roomId || !wsRef.current) return;
        const text = inputText;
        setInputText('');

        try {
            // We still hit the REST API to persist, but the Consumer might eventually handle all persistence.
            // For now, keep REST as truth, and let WebSocket do immediate UI updates if you refactor later.
            // Sending via websocket directly for the backend AI Analyzer to catch it
            wsRef.current.send(JSON.stringify({
                type: 'chat_message',
                message: text,
                username: currentUser
            }));

            // Optional: fallback to persist manually if the backend consumer doesn't save to DB
            await fetchApi(`/room/${roomId}/messages/`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });

        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    // --- WebRTC Video Logic ---
    const toggleVideo = async () => {
        if (isVideoActive) {
            // Turn off
            if (stream) stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsVideoActive(false);
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        } else {
            // Turn on & Initiate call
            try {
                const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(currentStream);
                setIsVideoActive(true);

                if (myVideoRef.current) {
                    myVideoRef.current.srcObject = currentStream;
                }

                const peer = new Peer({
                    initiator: true,
                    trickle: false,
                    stream: currentStream
                });

                peer.on('signal', (signal) => {
                    if (wsRef.current) {
                        wsRef.current.send(JSON.stringify({
                            type: 'video_signal',
                            signal: signal
                        }));
                    }
                });

                peer.on('stream', (remoteStream) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;
                    }
                });

                peerRef.current = peer;

            } catch (err) {
                console.error("Failed to get media devices", err);
                alert("Camera/Mic access denied.");
            }
        }
    };

    const handleReceiveOffer = async (incomingSignal: any) => {
        // Automatically accept or prompt? Let's auto-answer if they initiate.
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(currentStream);
            setIsVideoActive(true);

            if (myVideoRef.current) {
                myVideoRef.current.srcObject = currentStream;
            }

            const peer = new Peer({
                initiator: false,
                trickle: false,
                stream: currentStream
            });

            peer.on('signal', (signal) => {
                if (wsRef.current) {
                    wsRef.current.send(JSON.stringify({
                        type: 'video_signal',
                        signal: signal
                    }));
                }
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            });

            peer.signal(incomingSignal);
            peerRef.current = peer;

        } catch (err) {
            console.error("Failed to auto-answer call", err);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#050511] text-slate-900 dark:text-gray-100 transition-colors duration-300">
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
                                <em>Reason: {alert.reason}</em>
                            </p>

                            <div className="w-full relative mb-8 overflow-hidden rounded-xl border border-red-500/50 group">
                                <img
                                    src={alert.image_url}
                                    alt="AI Perception of Fraudster"
                                    className="w-full h-auto object-cover grayscale mix-blend-luminosity group-hover:grayscale-0 transition-all duration-1000"
                                />
                                <div className="absolute inset-0 bg-red-900/40 mix-blend-overlay"></div>
                                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs font-mono text-red-400 uppercase">
                                    AI Visual Perception of Node Intent
                                </div>
                            </div>

                            <button
                                onClick={() => setAlert(null)}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest transition-colors"
                            >
                                Acknowledge & Proceed with Caution
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 bg-white/50 dark:bg-black/40 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-6 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <Logo size="sm" showText={false} />
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                        {currentUser?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 dark:text-white">
                            Profound Match <span className="text-purple-500 font-mono ml-2 text-sm uppercase">[{currentUser || 'Anonymous'}]</span>
                        </h2>
                        <p className="text-xs text-green-600 dark:text-green-400 font-mono tracking-wider">SECURE CONNECTION</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleVideo}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm ${isVideoActive
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                        title="Toggle Video Link"
                    >
                        {isVideoActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isVideoActive ? 'End Link' : 'Establish Visual'}</span>
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('user');
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('refresh_token');
                            window.location.href = '/login';
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-sm bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-red-500 dark:text-red-400 border border-transparent hover:border-red-500/30"
                        title="Disconnect from Node"
                    >
                        <span className="hidden sm:inline uppercase">Disconnect</span>
                    </button>
                </div>
            </header>

            {/* Video Streams Container */}
            <AnimatePresence>
                {isVideoActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 200, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-200 dark:bg-black w-full shrink-0 flex items-center justify-center gap-4 overflow-hidden border-b border-slate-300 dark:border-white/10"
                    >
                        <div className="relative w-64 h-40 bg-slate-900 rounded-lg overflow-hidden border-2 border-purple-500">
                            <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono text-white">Local Node</div>
                        </div>
                        <div className="relative w-64 h-40 bg-slate-900 rounded-lg overflow-hidden border-2 border-cyan-500">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono text-white">Connected Mind</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-900/5 blur-[100px] rounded-full pointer-events-none transition-colors duration-500" />
                <div className="bg-noise mix-blend-overlay opacity-10 dark:opacity-5 pointer-events-none absolute inset-0" />

                <div className="text-center my-8">
                    <span className="px-3 py-1 text-xs rounded-full bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-mono border border-slate-300 dark:border-white/5">
                        Analysis complete. Connection established.
                    </span>
                </div>

                <AnimatePresence>
                    {messages.map((msg, index) => {
                        const isMe = currentUser ? msg.sender === currentUser : false;

                        return (
                            <motion.div
                                key={msg.id || index}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                layout
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group w-full`}
                            >
                                <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                                    {/* Message Bubble */}
                                    <div className={`relative px-5 py-3 shadow-md ${msg.deletedForEveryone
                                        ? 'bg-transparent border border-slate-300 dark:border-white/10 text-slate-500 italic'
                                        : isMe
                                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl rounded-tr-sm border border-purple-400/20'
                                            : 'bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-slate-800 dark:text-gray-200 rounded-2xl rounded-tl-sm'
                                        }`}>

                                        {!isMe && <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 tracking-wider mb-1 uppercase">{msg.sender}</p>}
                                        <p className="leading-relaxed whitespace-pre-wrap text-sm md:text-base">{msg.text}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <footer className="p-4 md:p-6 shrink-0 bg-transparent relative z-10 w-full max-w-5xl mx-auto">
                <div className="relative flex items-center shadow-lg rounded-full w-full">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Transmit message to node..."
                        className="w-full bg-white dark:bg-black/60 border border-slate-300 dark:border-white/20 rounded-full py-4 pl-6 pr-16 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-slate-400 dark:placeholder-gray-500 font-mono shadow-inner"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="absolute right-2 p-3 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-slate-400 dark:disabled:bg-gray-700 transition-colors flex items-center justify-center text-white"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
                <p className="text-center text-[10px] text-slate-500 dark:text-gray-600 font-mono mt-3 uppercase tracking-widest">
                    A.I. Analysis strictly monitors intent in real-time.
                </p>
            </footer>
        </div>
    );
}
