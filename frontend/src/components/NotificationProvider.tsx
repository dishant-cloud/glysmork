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

    // Tracks current pathname without stale closures
    const pathnameRef = useRef<string>(typeof window !== 'undefined' ? window.location.pathname : '/');

    // Sync path and clear active toast when user navigates to sender's direct chat
    useEffect(() => {
        const syncPath = () => {
            pathnameRef.current = window.location.pathname;
            const match = window.location.pathname.match(/\/messages\/([^\/]+)/);
            if (match && match[1]) {
                const targetSender = decodeURIComponent(match[1]);
                setNotifications(prev => prev.filter(n => n.sender !== targetSender));
            }
        };
        window.addEventListener('popstate', syncPath);
        window.addEventListener('next-route-change', syncPath);
        return () => {
            window.removeEventListener('popstate', syncPath);
            window.removeEventListener('next-route-change', syncPath);
        };
    }, []);

    // Consolidated Toast: Groups notifications by sender so screen is never flooded
    const showToast = (sender: string, text: string, type: string = 'Message') => {
        if (!sender || sender === 'system' || text === 'clear_notification') return;
        
        // Suppress toast if user is already actively chatting with this sender
        if (pathnameRef.current.includes(`/messages/${sender}`)) return;

        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.volume = 0.4;
            audio.play().catch(() => {});
        } catch {}

        setNotifications(prev => {
            const existingIndex = prev.findIndex(n => n.sender === sender);
            if (existingIndex !== -1) {
                // Sender already has an active toast! Update in place instead of spawning extra cards
                const updated = [...prev];
                const existing = updated[existingIndex];
                updated[existingIndex] = {
                    ...existing,
                    text: text,
                    count: (existing.count || 1) + 1,
                    updatedAt: Date.now()
                };
                return updated;
            } else {
                // New sender: spawn one clean consolidated toast card
                return [...prev, {
                    id: sender,
                    sender,
                    text,
                    type,
                    count: 1,
                    updatedAt: Date.now()
                }];
            }
        });
    };

    // Auto-dismiss inactive toasts after 6 seconds
    useEffect(() => {
        if (notifications.length === 0) return;
        const timer = setInterval(() => {
            const now = Date.now();
            setNotifications(prev => prev.filter(n => now - (n.updatedAt || 0) < 6000));
        }, 1000);
        return () => clearInterval(timer);
    }, [notifications.length]);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');
        if (!token || !userStr) return;

        let user: any;
        try {
            user = JSON.parse(userStr);
        } catch {
            return;
        }

        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).host
            : (isLocal ? `${host}:8000` : host);

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
                        if (data.sender && data.sender !== user.username) {
                            showToast(
                                data.sender,
                                data.text || 'sent you a message',
                                data.type === 'friend_message' ? 'Message' : 'Session'
                            );
                            window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: data }));
                        }
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onclose = () => {
                setIsOnline(false);
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                setTimeout(connect, 5000);
            };

            wsRef.current = ws;
        };

        connect();

        // FAILSAFE: Polling fallback for offline notifications
        let seenNotifTimestamps = new Set<string>();
        const poll = async () => {
            if (!user?.username) return;
            try {
                const data = await fetchApi(`/matchmaking/notifications/?username=${encodeURIComponent(user.username)}`);
                const notifs = data.notifications || [];
                for (const notif of notifs) {
                    const notifSender = notif.sender || notif.from_user;
                    if (notifSender && notifSender !== user.username) {
                        const stampKey = `${notifSender}_${notif.created_at || notif.id}_${notif.message}`;
                        if (!seenNotifTimestamps.has(stampKey)) {
                            seenNotifTimestamps.add(stampKey);
                            showToast(notifSender, notif.message || 'sent you a message', 'Message');
                            window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: { type: 'friend_message' } }));
                        }
                    }
                }
            } catch (e) {
                // Silently fail — WS is primary
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

            {/* Global Consolidated Toasts */}
            <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {notifications.map((notif) => (
                        <motion.div
                            key={notif.sender}
                            initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            onClick={() => {
                                window.location.href = `/messages/${encodeURIComponent(notif.sender)}`;
                                setNotifications(prev => prev.filter(n => n.sender !== notif.sender));
                            }}
                            className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-slate-200/80 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] flex items-start gap-3.5 min-w-[300px] max-w-sm relative overflow-hidden cursor-pointer hover:bg-white transition-all group"
                        >
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-600" />

                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 flex-shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                                <MessageSquare className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                                        {notif.type || 'Message'}
                                    </span>
                                    {notif.count > 1 && (
                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            {notif.count} new
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-medium ml-auto">Just now</span>
                                </div>
                                <h4 className="text-slate-900 font-bold text-sm mb-0.5 truncate">{notif.sender}</h4>
                                <p className="text-slate-600 text-xs line-clamp-2 leading-snug font-medium">
                                    {notif.text}
                                </p>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifications(prev => prev.filter(n => n.sender !== notif.sender));
                                }}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0"
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
