"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface NotificationContextProps {
    sendSignal: (type: string, payload: any) => void;
    onlineStatus: boolean;
}

const NotificationContext = createContext<NotificationContextProps>({
    sendSignal: () => {},
    onlineStatus: false,
});

export const useNotification = () => useContext(NotificationContext);

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Shared dedup store: prevents WS + polling from both firing a toast for the same message
    const seenNotifIds = useRef<Set<string | number>>(new Set());

    // Tracks current pathname without stale closures — updated on every navigation
    const pathnameRef = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : '/');

    useEffect(() => {
        const syncPath = () => { pathnameRef.current = window.location.pathname; };
        window.addEventListener('popstate', syncPath);
        window.addEventListener('next-route-change', syncPath);
        return () => {
            window.removeEventListener('popstate', syncPath);
            window.removeEventListener('next-route-change', syncPath);
        };
    }, []);

    const showToast = (id: string | number, sender: string, text: string, type: string) => {
        if (seenNotifIds.current.has(id)) return;
        if (pathnameRef.current.includes(`/messages/${sender}`)) return;
        if (sender === 'system' || text === 'clear_notification') return;

        seenNotifIds.current.add(id);

        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.volume = 0.4;
            audio.play().catch(() => {});
        } catch {}

        const newNotif = { id, sender, text, type };
        setNotifications(prev => [...prev, newNotif]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 7000);
    };

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');
        if (!token || !userStr) return;

        let user: any;
        try {
            user = JSON.parse(userStr);
        } catch {
            window.dispatchEvent(new CustomEvent('ws_debug_sys', { detail: 'FATAL: Corrupted User String. WS Aborted.' }));
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const wsHost = process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).host
            : `${host}:8000`;

        const connect = () => {
            const currentToken = localStorage.getItem('access_token');
            if (!currentToken) {
                setTimeout(connect, 2000);
                return;
            }

            console.log(`Notification WS: Connecting to ${wsHost}...`);
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/notifications/?token=${currentToken}`);

            ws.onopen = () => {
                console.log("Notification WS: CONNECTED");
                setIsOnline(true);
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 30000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    window.dispatchEvent(new CustomEvent('ws_debug_recv', { detail: data }));

                    if (data.type === 'incoming_call') {
                        window.dispatchEvent(new CustomEvent('sys_incoming_call', { detail: data }));
                    } else if (data.type === 'call_answered') {
                        window.dispatchEvent(new CustomEvent('sys_call_answered', { detail: data }));
                    } else if (data.type === 'ice_candidate') {
                        window.dispatchEvent(new CustomEvent('sys_ice_candidate', { detail: data }));
                    } else if (data.type === 'call_declined') {
                        window.dispatchEvent(new CustomEvent('sys_call_declined', { detail: data }));
                    } else if (data.type === 'call_ended') {
                        window.dispatchEvent(new CustomEvent('sys_call_ended', { detail: data }));
                    } else if (data.type === 'friend_message' || data.type === 'session_message') {
                        // Unique key per message: prevents polling from re-toasting the same thing
                        const dedupeId = `ws_${data.sender}_${data.id || data.text?.slice(0, 20)}`;
                        showToast(
                            dedupeId,
                            data.sender,
                            data.text,
                            data.type === 'friend_message' ? 'Message' : 'Session'
                        );
                        window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: data }));
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onclose = (event) => {
                window.dispatchEvent(new CustomEvent('ws_debug_sys', {
                    detail: `WEBSOCKET CLOSED! Code: ${event.code}, Reason: ${event.reason || 'none'}`
                }));
                setIsOnline(false);
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                setTimeout(connect, 5000);
            };

            wsRef.current = ws;
        };

        connect();

        // FAILSAFE: Polling fallback — only shows toast if WS didn't already handle it
        let lastNotifId = 0;
        const apiBase = process.env.NEXT_PUBLIC_API_URL || `http://${host}:8000`;

        const poll = async () => {
            if (!user?.username) return;
            try {
                const data = await fetchApi(`/matchmaking/notifications/?username=${encodeURIComponent(user.username)}`);
                const notifs = data.notifications || [];
                    if (notifs.length > 0) {
                        const latest = notifs[0];
                        if (latest.id > lastNotifId) {
                            lastNotifId = latest.id;
                            // seenNotifIds shared set prevents re-toast if WS already handled it
                            showToast(latest.id, latest.sender, latest.message, 'Message');
                            window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: { type: 'friend_message' } }));
                        }
                    }
            } catch (e) {
                // Silently fail — WS is primary transport
            }
        };

        const pollInterval = setInterval(poll, 4000);
        poll();

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            clearInterval(pollInterval);
        };
    }, []);

    const sendSignal = (type: string, payload: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const data = { type, ...payload };
            window.dispatchEvent(new CustomEvent('ws_debug_send', { detail: data }));
            wsRef.current.send(JSON.stringify(data));
        } else {
            console.warn("Cannot send signal, WS not open");
        }
    };

    return (
        <NotificationContext.Provider value={{ sendSignal, onlineStatus: isOnline }}>
            {children}

            {/* Global Toasts */}
            <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {notifications.map((notif) => (
                        <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/40 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-start gap-4 min-w-[320px] max-w-sm relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-600" />

                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-600/10 flex items-center justify-center text-purple-600 flex-shrink-0 border border-purple-500/20">
                                <MessageSquare className="w-6 h-6" />
                            </div>

                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-purple-500/80 uppercase tracking-[0.2em]">
                                        {notif.type} Received
                                    </span>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                                </div>
                                <h4 className="text-slate-900 font-bold text-[15px] mb-0.5">{notif.sender}</h4>
                                <p className="text-slate-500 text-[13px] line-clamp-2 leading-relaxed font-medium capitalize">
                                    {notif.text}
                                </p>
                            </div>

                            <button
                                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0 mt-0.5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    );
}
