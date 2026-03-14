"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Phone, PhoneOff, Video, VideoOff, CheckCheck, Trash2, UserPlus, Check } from 'lucide-react';
import Link from 'next/link';
import Peer from 'simple-peer';

type DmMessage = {
    id: number;
    sender: string;
    text: string;
    timestamp: string;
    isRead: boolean;
    deletedForEveryone: boolean;
};

const API = 'http://127.0.0.1:8001/api';

export default function DMPage() {
    const params   = useParams();
    const router   = useRouter();
    const friend   = params.username as string;

    const [myUsername, setMyUsername]         = useState<string | null>(null);
    const [messages, setMessages]             = useState<DmMessage[]>([]);
    const [input, setInput]                   = useState('');
    const [sending, setSending]               = useState(false);
    const [loading, setLoading]               = useState(true);
    const [contextMenu, setContextMenu]       = useState<{ id: number; x: number; y: number } | null>(null);
    const [friendStatus, setFriendStatus]     = useState<'none' | 'pending' | 'accepted'>('none');
    
    // WebRTC State
    const [isVideoActive, setIsVideoActive]   = useState(false);
    const [isVoiceActive, setIsVoiceActive]   = useState(false);
    const [stream, setStream]                 = useState<MediaStream | null>(null);
    const [callStatus, setCallStatus]         = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');

    const bottomRef                           = useRef<HTMLDivElement>(null);
    const wsRef                               = useRef<WebSocket | null>(null);
    const peerRef                             = useRef<Peer.Instance | null>(null);
    const incomingSignalRef                   = useRef<any>(null);
    const myVideoRef                          = useRef<HTMLVideoElement>(null);
    const remoteVideoRef                      = useRef<HTMLVideoElement>(null);

    const roomName                        = myUsername
        ? `direct_${[myUsername, friend].sort().join('_')}`
        : null;

    // Resolve logged-in user
    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            if (!u?.username) { router.push('/login'); return; }
            setMyUsername(u.username);
        } catch { router.push('/login'); }
    }, [router]);

    // Load message history & connect WebSocket when roomName is ready
    useEffect(() => {
        if (!roomName || !myUsername) return;

        loadMessages();
        connectWS();

        // Notify the friend that you want to chat
        fetch(`${API}/matchmaking/notify/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: myUsername, receiver: friend, room_name: roomName }),
        }).catch(() => {});

        // Check friendship status
        fetch(`${API}/matchmaking/friends/?username=${encodeURIComponent(myUsername)}`)
            .then(r => r.json())
            .then(data => {
                if (data.friends?.some((f: any) => f.username === friend || f === friend)) setFriendStatus('accepted');
                else if (data.sent?.some((f: any) => f.username === friend || f === friend)) setFriendStatus('pending');
            }).catch(() => {});

        return () => { wsRef.current?.close(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomName]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/room/${roomName}/messages/?username=${myUsername}`);
            if (res.ok) {
                const data: DmMessage[] = await res.json();
                setMessages(data);
            }
        } catch { /* use cached list */ }
        finally { setLoading(false); }
    };

    const connectWS = () => {
        if (wsRef.current) wsRef.current.close();
        const wsUrl = `ws://127.0.0.1:8001/ws/chat/${roomName}/`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'chat_message') {
                const newMsg: DmMessage = {
                    id: data.id ?? Date.now(),
                    sender: data.username,
                    text: data.message,
                    timestamp: data.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isRead: false,
                    deletedForEveryone: false,
                };
                setMessages(prev => {
                    // Deduplicate by id if already added optimistically
                    if (data.id && prev.some(m => m.id === data.id)) return prev;
                    return [...prev, newMsg];
                });
            }
            if (data.type === 'message_deleted') {
                setMessages(prev => prev.map(m =>
                    m.id === data.id ? { ...m, text: 'This message was deleted.', deletedForEveryone: true } : m
                ));
            }
            if (data.type === 'video_signal') {
                if (data.username !== myUsername) {
                    if (data.signal.type === 'offer') {
                        // Incoming call
                        setIsVideoActive(data.mode === 'video');
                        setIsVoiceActive(data.mode === 'voice');
                        setCallStatus('receiving');
                        handleReceiveOffer(data.signal, data.mode);
                    } else if (peerRef.current) {
                        peerRef.current.signal(data.signal);
                        if (data.signal.type === 'answer') {
                            setCallStatus('connected');
                        }
                    }
                }
            }
            if (data.type === 'end_call') {
                if (data.username !== myUsername) {
                    cleanupCall();
                }
            }
        };

        ws.onerror = () => { /* WS failed — messages still save via REST */ };
    };

    // --- WebRTC Logic ---
    const cleanupCall = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsVideoActive(false);
        setIsVoiceActive(false);
        setCallStatus('idle');
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
    };

    const startCall = async (mode: 'video' | 'voice') => {
        if (callStatus !== 'idle') return;
        setCallStatus('calling');
        setIsVideoActive(mode === 'video');
        setIsVoiceActive(mode === 'voice');

        try {
            const constraints = { video: mode === 'video', audio: true };
            const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(currentStream);

            if (myVideoRef.current && mode === 'video') {
                myVideoRef.current.srcObject = currentStream;
            }

            const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

            peer.on('signal', (signal: any) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'video_signal',
                        signal: signal,
                        username: myUsername,
                        mode: mode
                    }));
                }
            });

            peer.on('stream', (remoteStream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            });

            peer.on('close', cleanupCall);
            peerRef.current = peer;
        } catch (err) {
            console.error("Failed to start call", err);
            cleanupCall();
            alert("Camera/Mic access denied.");
        }
    };

    const handleReceiveOffer = async (incomingSignal: any, mode: 'video' | 'voice') => {
        // Just store the signal, the user must click Accept to actually answer
        incomingSignalRef.current = incomingSignal;
    };

    const acceptCall = async () => {
        if (callStatus !== 'receiving' || !incomingSignalRef.current) return;
        const offerSignal = incomingSignalRef.current;
        incomingSignalRef.current = null;
        setCallStatus('connected');

        try {
            const constraints = { video: isVideoActive, audio: true };
            const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(currentStream);

            if (myVideoRef.current && isVideoActive) {
                myVideoRef.current.srcObject = currentStream;
            }

            const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });

            peer.on('signal', (signal: any) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'video_signal',
                        signal: signal,
                        username: myUsername
                    }));
                }
            });

            peer.on('stream', (remoteStream: MediaStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            });

            peer.on('close', cleanupCall);
            peer.signal(offerSignal);
            peerRef.current = peer;
        } catch (err) {
            console.error("Failed to answer call", err);
            cleanupCall();
        }
    };

    const endCall = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end_call', username: myUsername }));
        }
        cleanupCall();
    };

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || sending || !roomName || !myUsername) return;
        const text = input.trim();
        setInput('');
        setSending(true);


        try {
            await fetch(`${API}/room/${roomName}/messages/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myUsername, text }),
            });
        } catch { /* optimistic message stays */ }
        finally { setSending(false); }
    };

    const deleteForEveryone = async (msgId: number) => {
        setContextMenu(null);
        try {
            await fetch(`${API}/room/messages/${msgId}/action/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                credentials: 'include',
                body: JSON.stringify({ action: 'delete_for_everyone' }),
            });
            setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, text: 'This message was deleted.', deletedForEveryone: true } : m
            ));
        } catch { /* ignore */ }
    };

    const getCsrf = () => {
        const c = document.cookie.match(/csrftoken=([^;]+)/);
        return c ? c[1] : '';
    };

    const friendInitial = friend.charAt(0).toUpperCase();

    return (
        <div
            className="flex flex-col h-screen bg-[#0a0a0f] text-white"
            onClick={() => setContextMenu(null)}
        >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#111118] border-b border-white/5 backdrop-blur-xl sticky top-0 z-20">
                <Link href="/messages" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-400" />
                </Link>

                {/* Avatar */}
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-black text-white text-sm shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                        {friendInitial}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#111118]" />
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-sm uppercase tracking-wider truncate">{friend}</h2>
                    <p className="text-[10px] font-mono text-gray-500">direct link</p>
                </div>

                {/* Actions: Add Friend + Voice + Video */}
                <div className="flex items-center gap-1">
                    {/* Add Friend */}
                    <button
                        onClick={async () => {
                            if (friendStatus !== 'none' || !myUsername) return;
                            try {
                                await fetch(`${API}/matchmaking/friends/`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ username: myUsername, target_username: friend, action: 'request' }),
                                });
                                setFriendStatus('pending');
                            } catch {}
                        }}
                        disabled={friendStatus !== 'none'}
                        className={`p-2 rounded-full transition-colors text-sm ${
                            friendStatus === 'accepted'
                                ? 'text-green-400 bg-green-400/10'
                                : friendStatus === 'pending'
                                    ? 'text-yellow-400 bg-yellow-400/10 cursor-default'
                                    : 'text-gray-400 hover:bg-white/10 hover:text-purple-400'
                        }`}
                        title={friendStatus === 'accepted' ? 'Friends' : friendStatus === 'pending' ? 'Request sent' : 'Add Friend'}
                    >
                        {friendStatus === 'accepted' ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                    </button>
                    {/* Voice + Video Actions */}
                    <button onClick={() => startCall('voice')} disabled={callStatus !== 'idle'}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Phone className="w-5 h-5" />
                    </button>
                    <button onClick={() => startCall('video')} disabled={callStatus !== 'idle'}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed">
                        <Video className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ── Call Overlay ── */}
            <AnimatePresence>
                {callStatus !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-16 left-4 right-4 z-40 bg-[#1a1a2e]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 overflow-hidden"
                        style={{ minHeight: callStatus === 'connected' && isVideoActive ? '280px' : 'auto' }}
                    >
                        <div className="flex flex-col items-center justify-center p-4">
                            
                            {/* Call Status Text */}
                            <div className="mb-4 text-center">
                                <h3 className="font-bold text-lg text-white">
                                    {callStatus === 'receiving' ? `Incoming ${isVoiceActive ? 'Voice' : 'Video'} Call` : 
                                     callStatus === 'calling' ? `Calling ${friend}...` : 
                                     `${isVoiceActive ? 'Voice' : 'Video'} Call`}
                                </h3>
                                {callStatus === 'receiving' && (
                                    <p className="text-gray-400 text-sm">{friend} is calling you</p>
                                )}
                            </div>

                            {/* Avatars for calling/receiving/voice */}
                            {(callStatus !== 'connected' || !isVideoActive) && (
                                <div className="relative mb-6">
                                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-black text-white text-3xl shadow-[0_0_25px_rgba(34,211,238,0.4)] ${callStatus === 'calling' || callStatus === 'receiving' ? 'animate-pulse' : ''}`}>
                                        {friendInitial}
                                    </div>
                                    <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin opacity-50"></div>
                                </div>
                            )}

                            {/* Video Elements for Connected Video Calls */}
                            {callStatus === 'connected' && isVideoActive && (
                                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 border border-white/10 shadow-inner">
                                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <video ref={myVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-24 h-32 object-cover bg-gray-900 rounded-lg border-2 border-white/20 shadow-lg" />
                                </div>
                            )}

                            {/* Controls */}
                            <div className="flex gap-4">
                                {callStatus === 'receiving' && (
                                    <button onClick={acceptCall} className="px-6 py-3 bg-green-500 hover:bg-green-400 text-white rounded-full font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all flex items-center gap-2">
                                        {isVoiceActive ? <Phone className="w-5 h-5 fill-current" /> : <Video className="w-5 h-5 fill-current" />}
                                        Accept
                                    </button>
                                )}
                                <button onClick={endCall} className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-full font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2">
                                        <PhoneOff className="w-5 h-5" />
                                        {callStatus === 'receiving' ? 'Decline' : 'End Call'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth">
                {loading ? (
                    <div className="flex justify-center items-center h-full opacity-30">
                        <div className="w-6 h-6 border-2 border-t-cyan-400 rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-3xl font-black">
                            {friendInitial}
                        </div>
                        <p className="font-mono text-xs text-gray-500">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((msg, idx) => {
                            const isMe = msg.sender === myUsername;
                            const isDeleted = msg.deletedForEveryone;
                            const showTime = idx === 0 ||
                                messages[idx - 1].sender !== msg.sender;

                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`relative group max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}
                                        onContextMenu={(e) => {
                                            if (isMe && !isDeleted) {
                                                e.preventDefault();
                                                setContextMenu({ id: msg.id, x: e.clientX, y: e.clientY });
                                            }
                                        }}
                                    >
                                        <div className={`px-4 py-2.5 text-sm leading-relaxed break-words rounded-2xl ${
                                            isDeleted
                                                ? 'bg-white/5 text-gray-500 italic border border-white/5'
                                                : isMe
                                                    ? 'bg-gradient-to-br from-cyan-600 to-cyan-500 text-white rounded-br-sm shadow-[0_2px_15px_rgba(34,211,238,0.2)]'
                                                    : 'bg-white/8 border border-white/8 text-gray-100 rounded-bl-sm backdrop-blur-sm'
                                        }`}>
                                            {msg.text}
                                        </div>

                                        <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <span className="text-[10px] text-gray-600 font-mono">{msg.timestamp}</span>
                                            {isMe && !isDeleted && (
                                                <CheckCheck className={`w-3 h-3 ${msg.isRead ? 'text-cyan-400' : 'text-gray-500'}`} />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
                <div ref={bottomRef} />
            </div>

            {/* ── Context Menu (right-click delete) ── */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-50 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            onClick={() => deleteForEveryone(contextMenu.id)}
                            className="flex items-center gap-3 px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete for Everyone
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Input bar ── */}
            <div className="px-4 py-3 bg-[#111118] border-t border-white/5 backdrop-blur-xl">
                <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                    <textarea
                        value={input}
                        onChange={e => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder={`Message ${friend}...`}
                        rows={1}
                        className="flex-1 bg-transparent text-white placeholder-gray-600 font-light text-sm resize-none focus:outline-none max-h-[120px] py-1"
                    />
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={sendMessage}
                        disabled={!input.trim() || sending}
                        className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </motion.button>
                </div>
                <p className="text-center text-[10px] text-gray-700 font-mono mt-1.5">Enter to send · Shift+Enter for new line</p>
            </div>
        </div>
    );
}
