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
    const [urlMode, setUrlMode] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
    const [alert, setAlert] = useState<AnalysisAlert | null>(null);
    const [showExitModal, setShowExitModal] = useState(false);
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
    const [showToast, setShowToast] = useState<string | null>(null);
    const [matchReason, setMatchReason] = useState<string | null>(null);

    const { startCall, endCall } = useCall();
    const router = useRouter();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isExitingRef = useRef(false);

    // Use standard beforeunload instead of breaking browser history
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (roomId?.startsWith('session_') && !isExitingRef.current) {
                e.preventDefault();
                e.returnValue = ''; // Shows standard browser warning
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [roomId]);

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
        const md = params.get('mode');
        if (md) setUrlMode(md);
        if (rm) {
            setRoomId(rm);
            fetchApi(`/room/${rm}/status/`)
                .then(statusRes => {
                    if (statusRes.is_active === false && !rm.startsWith('direct_')) {
                        window.location.replace('/dashboard?exit=partner');
                    }
                })
                .catch(() => { });

            fetchApi(`/room/${rm}/`)
                .then(data => {
                    if (data.match_reason) setMatchReason(data.match_reason);
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

    // Merge-fetch: updates state without dropping optimistic messages
    const fetchAndMergeMessages = useCallback(async (rid: string, user: string) => {
        try {
            const data = await fetchApi(`/room/${rid}/messages/?username=${encodeURIComponent(user)}`);
            const fetchedRaw: any[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
            if (fetchedRaw.length === 0) return;
            const fetched: ChatMessage[] = fetchedRaw.map(m => ({
                id: m.id,
                client_id: m.client_id,
                sender: m.username || m.sender,
                text: m.value || m.text || "",
                isRead: m.is_read || m.isRead || false,
                deletedForEveryone: m.deleted_for_everyone || m.deletedForEveryone || false,
                timestamp: m.date || m.timestamp,
                is_call_log: m.is_call_log,
                call_mode: m.call_mode,
                call_status: m.call_status,
                call_duration: m.call_duration
            }));
            setMessages(prev => {
                const fetchedIds = new Set(fetched.map(m => m.id));
                const fetchedClientIds = new Set(fetched.map(m => m.client_id).filter(Boolean));
                // Keep optimistic messages not yet in DB
                const optimistic = prev.filter(m =>
                    (m.id > 1e12) && // temp ID (Date.now() based)
                    !fetchedIds.has(m.id) &&
                    (!m.client_id || !fetchedClientIds.has(m.client_id))
                );
                return [...fetched, ...optimistic];
            });
        } catch { }
    }, []);

    // WebSocket and initial fetch setup
    useEffect(() => {
        if (!roomId || !currentUser) return;
        fetchAndMergeMessages(roomId, currentUser);
        const pollInterval = setInterval(() => fetchAndMergeMessages(roomId, currentUser), 3000);

        try {
            const token = localStorage.getItem('access_token');
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            const wsHost = process.env.NEXT_PUBLIC_API_URL 
                ? new URL(process.env.NEXT_PUBLIC_API_URL).host 
                : (isLocal ? `${host}:8000` : host);
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
                            timestamp: data.date_iso || data.timestamp || new Date().toISOString(),
                            status: (data.username || data.sender) === currentUser ? 'sent' : 'read',
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
                        isExitingRef.current = true;
                        window.location.replace('/dashboard?exit=partner');
                    }
                } else if (data.type === 'user_left') {
                    isExitingRef.current = true;
                    window.location.replace('/dashboard?exit=partner');
                }
            };
        } catch (e) {
            console.log("WebSocket failed", e);
        }

        // Separate status check every 5s (doesn't touch message state)
        const statusInt = setInterval(async () => {
            try {
                const statusRes = await fetchApi(`/room/${roomId}/status/`);
                if (statusRes.is_active === false && !roomId.startsWith('direct_')) {
                    isExitingRef.current = true;
                    window.location.replace('/dashboard?exit=partner');
                }
            } catch { }
        }, 5000);

        return () => {
            if (wsRef.current) wsRef.current.close();
            clearInterval(pollInterval);
            clearInterval(statusInt);
            if (roomId?.startsWith('session_')) {
                endCall();
            }
        };
    }, [roomId, currentUser, fetchAndMergeMessages, endCall]);



    const performExit = async () => {
        isExitingRef.current = true;
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

    // AUTO-START VIDEO CALL for Roulette / Video Male / Female modes
    const autoCallFiredRef = useRef(false);
    useEffect(() => {
        if (urlMode === 'video' && partnerUsername && roomId && !autoCallFiredRef.current) {
            autoCallFiredRef.current = true;
            // Small delay to let the page settle, then auto-start video call
            const t = setTimeout(() => {
                startCall(partnerUsername, 'video', roomId);
            }, 800);
            return () => clearTimeout(t);
        }
    }, [urlMode, partnerUsername, roomId, startCall]);

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
            timestamp: new Date().toISOString(),
            status: 'sent'
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
        <div className="fixed inset-0 flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden z-[50]">

            {/* Toast Notification */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-emerald-500 text-white font-semibold text-sm shadow-lg rounded-2xl"
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
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white border border-sky-200 rounded-2xl p-8 max-w-lg shadow-2xl flex flex-col items-center text-center"
                        >
                            <AlertTriangle className="w-12 h-12 text-sky-500 mb-4" />
                            <h2 className="text-xl font-bold text-slate-900 mb-2">AI Safety Warning</h2>
                            <p className="text-slate-600 mb-6 text-sm border-l-4 border-sky-400 pl-4 text-left">
                                Suspicious behavior detected from <strong>{alert.username}</strong>.
                                <br /><em className="text-sky-500">Reason: {alert.reason}</em>
                            </p>
                            <div className="w-full mb-6 overflow-hidden rounded-xl border border-slate-200">
                                <img src={alert.image_url} alt="AI Perception" className="w-full h-auto object-cover" />
                            </div>
                            <button
                                onClick={() => setAlert(null)}
                                className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors rounded-xl"
                            >
                                Acknowledge & Proceed with Caution
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 z-20 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    {/* Back Button */}
                    <button
                        onClick={() => {
                            if (roomId?.startsWith('session_')) {
                                setShowExitModal(true);
                            } else {
                                window.location.replace('/dashboard');
                            }
                        }}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        title="Return to Dashboard"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-violet-100 border-2 border-violet-200 flex items-center justify-center text-violet-600 font-bold text-base shrink-0">
                        {partnerUsername?.[0]?.toUpperCase() ?? '?'}
                    </div>

                    {/* Partner Info */}
                    <div>
                        <p className="font-semibold text-slate-900 text-sm leading-tight">
                            {partnerUsername ?? <span className="text-slate-400 italic font-normal animate-pulse">Connecting...</span>}
                        </p>
                        <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                            Active now
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {partnerUsername && (
                        <button
                            onClick={handleAddFriend}
                            disabled={friendStatus !== 'none'}
                            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold border ${
                                friendStatus === 'accepted'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                    : friendStatus === 'pending'
                                        ? 'bg-blue-50 border-blue-200 text-blue-500 opacity-70'
                                        : 'bg-white border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-600'
                            }`}
                        >
                            {friendStatus === 'accepted' ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                            <span>{friendStatus === 'accepted' ? 'Friends' : friendStatus === 'pending' ? 'Requested' : 'Add Friend'}</span>
                        </button>
                    )}

                    {(roomId?.startsWith('direct_') || (roomId?.startsWith('session_') && urlMode === 'video')) && (
                        <>
                            <button
                                onClick={() => { if (partnerUsername) startCall(partnerUsername, 'video', roomId || undefined); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200"
                                title="Video Call"
                            >
                                <Video className="w-4 h-4" />
                                <span className="hidden sm:inline">Video</span>
                            </button>
                            <button
                                onClick={() => { if (partnerUsername) startCall(partnerUsername, 'audio', roomId || undefined); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                                title="Audio Call"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="hidden sm:inline">Call</span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setShowExitModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-500 border border-sky-200"
                        title="Leave Chat"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Leave</span>
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
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center"
                        >
                            <div className="w-14 h-14 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-sky-100">
                                <LogOut className="w-7 h-7 text-sky-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Leave the chat?</h3>
                            <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                                You are about to end this session. All local history for this match will be lost.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={performExit}
                                    className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors text-sm"
                                >
                                    End Session
                                </button>
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm"
                                >
                                    Stay Here
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages Area */}
            <main ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-3 bg-slate-50 overscroll-contain">

                {/* Session start marker */}
                <div className="text-center my-4">
                    <span className="px-4 py-1.5 rounded-full bg-slate-200 text-slate-500 text-xs font-medium">
                        Secure Connection Established
                    </span>
                </div>

                {matchReason && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-auto max-w-2xl p-4 bg-white border border-violet-100 rounded-2xl shadow-sm mb-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-violet-50 rounded-xl border border-violet-100 shrink-0">
                                <Activity className="w-4 h-4 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">Neural Connection Insights</h3>
                                <p className="text-sm text-slate-700 leading-relaxed">{matchReason}</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <AnimatePresence>
                    {messages.map((msg, index) => {
                        const isMe = currentUser ? msg.sender === currentUser : false;
                        const isDeleted = msg.deletedForEveryone;

                        if (msg.is_call_log) {
                            const Icon = msg.call_mode === 'video' ? Video : Phone;
                            const statusColor = msg.call_status === 'ended' ? 'text-slate-600' : 'text-sky-500';
                            const durationDisp = msg.call_duration ? `${Math.floor(msg.call_duration/60)}:${(msg.call_duration%60).toString().padStart(2, '0')}` : '';

                            return (
                                <motion.div key={msg.id || index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout className="flex justify-center w-full my-2">
                                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm text-sm">
                                        <div className={`p-1.5 rounded-full bg-slate-50 ${statusColor}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-slate-600 text-xs font-medium">
                                            {msg.call_mode === 'video' ? 'Video' : 'Audio'} call {msg.call_status} {durationDisp && `· ${durationDisp}`}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={msg.id || index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                layout
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}
                            >
                                <div className={`max-w-[80%] md:max-w-[65%] lg:max-w-[55%]`}>
                                    {!isMe && (
                                        <p className="text-[11px] font-semibold text-violet-500 mb-1 ml-1">
                                            {msg.sender}
                                        </p>
                                    )}
                                    <div className={`relative px-5 py-3 shadow-sm text-[15px] leading-relaxed ${
                                        msg.deletedForEveryone
                                            ? 'bg-slate-100 text-slate-500 italic rounded-[24px]'
                                            : isMe
                                                ? 'bg-slate-900 text-white rounded-[24px] rounded-br-sm shadow-[0_5px_15px_-5px_rgba(15,23,42,0.1)]'
                                                : 'bg-white text-slate-800 border border-slate-200/60 rounded-[24px] rounded-bl-sm'
                                    }`}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                        <p className={`text-[11px] mt-1.5 font-medium ${isMe ? 'text-slate-300 text-right' : 'text-slate-400'}`}>
                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-2" />
            </main>

            {/* Input Footer */}
            <footer className="bg-white/90 backdrop-blur-2xl border-t border-slate-200/60 p-4 shrink-0 z-20">
                <div className="flex items-end gap-3 bg-[#fafaf9] rounded-[24px] px-4 py-2 border border-slate-200 focus-within:border-slate-400 focus-within:shadow-sm transition-all shadow-inner">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent py-2 px-2 text-[15px] font-medium text-slate-800 focus:outline-none placeholder-slate-400 text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="p-3 mb-0.5 rounded-full bg-slate-900 border-2 border-slate-900 shadow-md hover:-translate-y-0.5 disabled:opacity-40 disabled:bg-slate-300 disabled:border-slate-300 transition-all flex items-center justify-center text-white"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </footer>
        </div>
    );
}
