"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Phone, PhoneOff, Video, VideoOff, CheckCheck, Trash2, UserPlus, Check, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useCall } from '@/components/CallProvider';

type DmMessage = {
    id: any;
    sender: string;
    text: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
    isRead: boolean;
    deletedForEveryone: boolean;
    is_ephemeral?: boolean;
    client_id?: string;
    is_call_log?: boolean;
    call_mode?: 'audio' | 'video';
    call_status?: 'ended' | 'declined' | 'no_answer' | 'unavailable' | 'cancelled';
    call_duration?: number;
};

const API = 'http://127.0.0.1:8000/api';

export default function DMPage() {
    const params = useParams();
    const router = useRouter();
    const friend = params.username as string;
    const { startCall } = useCall();

    const [myUsername, setMyUsername] = useState<string | null>(null);
    const [messages, setMessages] = useState<DmMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<any>(null);
    
    const [peerTyping, setPeerTyping] = useState(false);
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
    const [contextMenu, setContextMenu] = useState<{ id: number; x: number; y: number } | null>(null);

    const bottomRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const roomName = myUsername
        ? (friend.startsWith('session_') ? friend : `direct_${[myUsername, friend].sort().join('_')}`)
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
        clearNotifications();

        // Check friendship status
        if (!roomName.startsWith('session_')) {
            fetch(`${API}/matchmaking/friends/?username=${encodeURIComponent(myUsername)}`)
                .then(r => r.json())
                .then(data => {
                    const isFriend = data.friends?.some((f: any) => (f.username === friend || f === friend));
                    const isPending = data.sent?.some((f: any) => (f.username === friend || f === friend));
                    if (isFriend) setFriendStatus('accepted');
                    else if (isPending) setFriendStatus('pending');
                }).catch(() => { });
        } else {
            setFriendStatus('none');
        }

        return () => { 
            wsRef.current?.close(); 
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [roomName, myUsername]);

    const loadMessages = async (cursor?: any) => {
        if (loadingMore) return;
        if (!cursor) setLoading(true);
        else setLoadingMore(true);

        try {
            const url = `${API}/room/${roomName}/messages/?username=${myUsername}${cursor ? `&cursor=${cursor}` : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const newMsgs = (data.results || []).map((m: any) => ({
                    ...m,
                    timestamp: m.date_iso ? new Date(m.date_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (m.date ? new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : m.timestamp)
                }));
                if (cursor) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNew = newMsgs.filter((m: any) => !existingIds.has(m.id));
                        return [...uniqueNew, ...prev];
                    });
                } else {
                    setMessages(newMsgs);
                }
                setHasMore(data.has_more);
                setNextCursor(data.next_cursor);
                
                // If we just loaded the first batch, send a read receipt
                if (!cursor && newMsgs.length > 0) {
                   sendReadReceipt();
                }
            }
        } catch (err) {
            console.error("Load messages error:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const clearNotifications = async () => {
        if (!myUsername || !friend) return;
        try {
            // Fetch unread notifications for this user
            const url = `${API}/matchmaking/notifications/?username=${encodeURIComponent(myUsername)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const relevantNotifs = data.notifications?.filter((n: any) => n.sender === friend);
                if (relevantNotifs && relevantNotifs.length > 0) {
                    const ids = relevantNotifs.map((n: any) => n.id);
                    await fetch(`${API}/matchmaking/notifications/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids }),
                    });
                }
            }
        } catch (err) {
            console.error("Clear notifications error:", err);
        }
    };

    const connectWS = () => {
        if (wsRef.current) wsRef.current.close();
        const token = localStorage.getItem('access_token');
        const host = window.location.hostname;
        const wsUrl = `ws://${host}:8000/ws/chat/${roomName}/?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            
            if (data.type === 'chat_message') {
                const fallbackId = Date.now() + Math.random();
                const newMsg: DmMessage = {
                    id: data.id ?? fallbackId,
                    client_id: data.client_id,
                    sender: data.username || data.sender,
                    text: data.message || data.text || "",
                    timestamp: data.date_iso ? new Date(data.date_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (data.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                    status: data.status || ((data.username || data.sender) === myUsername ? 'sent' : 'read'),
                    isRead: data.status === 'read' || (data.username || data.sender) !== myUsername,
                    deletedForEveryone: false,
                    is_call_log: data.is_call_log,
                    call_mode: data.call_mode,
                    call_status: data.call_status,
                    call_duration: data.call_duration,
                };
                setMessages(prev => {
                    // Deduplicate by DB id OR client_id
                    if (data.id && prev.some(m => m.id === data.id)) return prev;
                    if (data.client_id && prev.some(m => m.client_id === data.client_id)) {
                        // Update the existing optimistic message with the real DB ID if available
                        return prev.map(m => m.client_id === data.client_id ? { ...m, id: data.id ?? m.id } : m);
                    }
                    return [...prev, newMsg];
                });
                // Send read receipt if it's from friend
                if (data.username !== myUsername) {
                   sendReadReceipt();
                }
            }
            
            if (data.type === 'typing_indicator') {
                if (data.username !== myUsername) {
                    setPeerTyping(data.event === 'typing_start');
                }
            }

            if (data.type === 'read_receipt') {
                if (data.read_by !== myUsername) {
                    setMessages(prev => prev.map(m => 
                        m.sender === myUsername ? { ...m, status: 'read' } : m
                    ));
                }
            }

            if (data.type === 'message_deleted') {
                setMessages(prev => prev.map(m =>
                    m.id === data.id ? { ...m, text: 'This message was deleted.', deletedForEveryone: true } : m
                ));
            }
        };
    };

    const sendReadReceipt = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'read_receipt',
                conversation_id: roomName,
                session_id: roomName
            }));
        }
    };

    const handleTyping = (isTyping: boolean) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: isTyping ? 'typing_start' : 'typing_stop',
                username: myUsername
            }));
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || sending || !roomName || !myUsername) return;
        const text = input.trim();
        setInput('');
        setSending(true);
        handleTyping(false); // Stop typing on send

        const clientId = crypto.randomUUID();

        // Optimistic UI update
        const optimisticMsg: DmMessage = {
            id: Date.now() + Math.random(), // Temp ID
            client_id: clientId,
            sender: myUsername,
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent',
            isRead: false,
            deletedForEveryone: false
        };
        setMessages(prev => [...prev, optimisticMsg]);

        // Dispatch over WebSocket for instant delivery to online peer
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat_message',
                message: text,
                username: myUsername,
                client_id: clientId
            }));
        }

        try {
            await fetch(`${API}/room/${roomName}/messages/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myUsername, text, client_id: clientId }),
            });
        } catch { /* optimistic handling */ }
        finally { setSending(false); }
    };

    const deleteForEveryone = async (msgId: number) => {
        setContextMenu(null);
        try {
            await fetch(`${API}/room/messages/${msgId}/action/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_for_everyone' }),
            });
            setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, text: 'This message was deleted.', deletedForEveryone: true } : m
            ));
        } catch { }
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, peerTyping]);

    const friendInitial = friend.replace('session_', '').charAt(0).toUpperCase();

    return (
        <div className="flex flex-col h-screen bg-[#fafaf9] text-slate-900 font-sans" onClick={() => setContextMenu(null)}>
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 sticky top-0 z-20 shadow-sm">
                <button onClick={() => window.history.length > 2 ? router.back() : router.push('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                        {friendInitial}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-[15px] uppercase tracking-wide text-slate-800 truncate">{friend.replace('session_', 'Guest ')}</h2>
                    <p className="text-[12px] font-medium text-slate-500">{roomName?.startsWith('session_') ? 'Discovery Session' : 'Direct Message'}</p>
                </div>
                <div className="flex items-center gap-1">
                    {!roomName?.startsWith('session_') && (
                        <button
                            onClick={async () => {
                                if (friendStatus !== 'none') return;
                                try {
                                    await fetch(`${API}/matchmaking/friends/`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username: myUsername, target_username: friend, action: 'request' }),
                                    });
                                    setFriendStatus('pending');
                                } catch { }
                            }}
                            className={`p-2 rounded-full transition-colors ${friendStatus === 'accepted' ? 'text-emerald-500 bg-emerald-50' : friendStatus === 'pending' ? 'text-amber-500' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {friendStatus === 'accepted' ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={() => startCall(friend.replace('session_', ''), 'audio', roomName || undefined)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"><Phone className="w-5 h-5" /></button>
                    <button onClick={() => startCall(friend.replace('session_', ''), 'video', roomName || undefined)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"><Video className="w-5 h-5" /></button>
                </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {hasMore && (
                    <div className="flex justify-center pb-4">
                        <button 
                            onClick={() => loadMessages(nextCursor)}
                            disabled={loadingMore}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center gap-2 bg-white px-4 py-2 border border-slate-200 rounded-full shadow-sm transition-colors"
                        >
                            {loadingMore ? 'Syncing...' : 'Older messages'}
                            <MoreHorizontal className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-10 opacity-40"><div className="w-6 h-6 border-2 border-t-slate-800 rounded-full animate-spin" /></div>
                ) : (
                    <>
                        {messages.map((msg, idx) => {
                            const isMe = msg.sender === myUsername;
                            const isDeleted = msg.deletedForEveryone;
                            
                            if (msg.is_call_log) {
                                const Icon = msg.call_mode === 'video' ? Video : Phone;
                                const statusColor = msg.call_status === 'ended' ? 'text-emerald-600' : 'text-rose-500';
                                const durationDisp = msg.call_duration ? `${Math.floor(msg.call_duration/60)}:${(msg.call_duration%60).toString().padStart(2, '0')}` : '';
                                
                                return (
                                    <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-4">
                                        <div className="bg-white border border-slate-200/80 shadow-sm rounded-[20px] px-5 py-3 flex items-center gap-4">
                                            <div className={`p-2.5 rounded-full bg-slate-50 ${statusColor}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">
                                                    {msg.call_mode} call {msg.call_status}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-2 mt-0.5">
                                                    {msg.timestamp} {durationDisp && `• ${durationDisp}`}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.div key={msg.id || idx} initial={{ opacity: 0, x: isMe ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div 
                                        className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                        onContextMenu={(e) => { if (isMe && !isDeleted) { e.preventDefault(); setContextMenu({ id: msg.id, x: e.clientX, y: e.clientY }); } }}
                                    >
                                        <div className={`px-5 py-3 text-[15px] leading-relaxed shadow-sm ${isDeleted ? 'bg-slate-100 text-slate-500 italic rounded-[24px]' : isMe ? 'bg-slate-900 text-white rounded-[24px] rounded-br-sm' : 'bg-white text-slate-800 border border-slate-200/60 rounded-[24px] rounded-bl-sm'}`}>
                                            {msg.text}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1.5 px-2">
                                            <span className="text-[11px] font-medium text-slate-400">
                                                {msg.timestamp}
                                            </span>
                                            {isMe && !isDeleted && (
                                                msg.status === 'read' ? (
                                                    <CheckCheck className="w-[14px] h-[14px] text-emerald-500" />
                                                ) : (
                                                    <Check className="w-[14px] h-[14px] text-slate-400" />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {peerTyping && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                <div className="bg-white border border-slate-200/60 px-4 py-3 rounded-[24px] rounded-bl-sm flex gap-1.5 items-center shadow-sm">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
                <div ref={bottomRef} className="h-4" />
            </div>

            {/* ── Input bar ── */}
            <div className="p-4 bg-white/90 backdrop-blur-2xl border-t border-slate-200/60 z-20">
                <div className="flex items-end gap-3 bg-[#fafaf9] rounded-[24px] px-4 py-2 border border-slate-200 focus-within:border-slate-400 focus-within:shadow-sm transition-all shadow-inner">
                    <textarea
                        value={input}
                        onChange={e => {
                            setInput(e.target.value);
                            handleTyping(e.target.value.length > 0);
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                            typingTimeoutRef.current = setTimeout(() => handleTyping(false), 3000);
                        }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 bg-transparent text-[15px] font-medium text-slate-800 placeholder-slate-400 p-2 focus:outline-none resize-none max-h-32"
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending} className="p-3 mb-0.5 bg-slate-900 text-white rounded-full disabled:opacity-40 disabled:bg-slate-300 hover:bg-slate-800 hover:-translate-y-0.5 transition-all shadow-md">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed z-50 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5" style={{ top: contextMenu.y, left: contextMenu.x - 150 }}>
                        <button onClick={() => deleteForEveryone(contextMenu.id)} className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 w-full rounded-lg transition-colors"><Trash2 className="w-4 h-4" /> Delete for everyone</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
