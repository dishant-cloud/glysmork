"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, X, Check, MessageSquare, Bell } from 'lucide-react';

interface NotificationContextProps {
    sendSignal: (type: string, payload: any) => void;
    onlineStatus: boolean; // Is the WS connected?
}

const NotificationContext = createContext<NotificationContextProps>({
    sendSignal: () => { },
    onlineStatus: false,
});

export const useNotification = () => useContext(NotificationContext);

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // (Removed old incomingCall state as CallProvider handles it now)

    useEffect(() => {
        // Only connect if user is logged in
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');

        if (!token || !userStr) {
            // Unauthenticated user, just return silently
            return;
        }

        let user;
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

        // Connect to the generic notifications channel
        const connect = () => {
            const currentToken = localStorage.getItem('access_token');
            if (!currentToken) {
                console.warn("Notification WS: No token available yet, waiting...");
                setTimeout(connect, 2000);
                return;
            }

            console.log(`Notification WS: Connecting to ${wsHost} with token ${currentToken.substring(0, 8)}...`);
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/notifications/?token=${currentToken}`);

            ws.onopen = () => {
                console.log("Notification WS: CONNECTED SUCCESSFULLY");
                setIsOnline(true);
                // Start pinging every 30s to keep Redis standard online
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
                        // Avoid showing popup if we are already in that specific chat room
                        const isChatPage = window.location.pathname.includes(`/messages/${data.sender}`);
                        
                        if (!isChatPage) {
                            // Play a subtle notification sound
                            try {
                                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                                audio.volume = 0.4;
                                audio.play().catch(() => {}); // Browsers might block auto-play until interaction
                            } catch {}

                            const newNotif = {
                                id: Date.now(),
                                sender: data.sender,
                                text: data.text,
                                type: data.type === 'friend_message' ? 'Message' : 'Session'
                            };
                            setNotifications(prev => [...prev, newNotif]);

                            // Auto-remove after 7s
                            setTimeout(() => {
                                setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
                            }, 7000);
                        }
                        
                        window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: data }));
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onclose = (event) => {
                window.dispatchEvent(new CustomEvent('ws_debug_sys', { 
                    detail: `WEBSOCKET CLOSED! Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}` 
                }));
                console.warn(`WebSocket closed: ${event.code} ${event.reason}`);
                setIsOnline(false);
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                // Try reconnecting in 5s
                setTimeout(connect, 5000);
            };

            wsRef.current = ws;
        };

        connect();

        // FAILSAFE: Polling fallback in case WS is unreliable
        let lastNotifId = 0;
        const poll = async () => {
            if (!user?.username) return;
            try {
                const host = window.location.hostname;
                const res = await fetch(`http://${host}:8000/api/matchmaking/notifications/?username=${encodeURIComponent(user.username)}`);
                if (res.ok) {
                    const data = await res.json();
                    const notifs = data.notifications || [];
                    if (notifs.length > 0) {
                        const latest = notifs[0];
                        if (latest.id > lastNotifId) {
                            console.log("[POLLING] New notification found via fallback!", latest);
                            // Only show popup if it's genuinely new AND we aren't in that chat
                            const isChatPage = window.location.pathname.includes(`/messages/${latest.sender}`);
                            if (!isChatPage && lastNotifId !== 0) {
                                // Play sound
                                try {
                                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                                    audio.volume = 0.3;
                                    audio.play().catch(() => {});
                                } catch {}

                                const newNotif = {
                                    id: latest.id,
                                    sender: latest.sender,
                                    text: latest.message,
                                    type: 'Message'
                                };
                                setNotifications(prev => {
                                    if (prev.find(n => n.id === newNotif.id)) return prev;
                                    return [...prev, newNotif];
                                });
                                setTimeout(() => {
                                    setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
                                }, 7000);
                            }
                            lastNotifId = latest.id;
                            // Also tell Header to update
                            window.dispatchEvent(new CustomEvent('sys_friend_message', { detail: { type: 'friend_message' } }));
                        }
                    }
                }
            } catch (e) {
                console.error("[POLLING] Fallback error", e);
            }
        };

        const pollInterval = setInterval(poll, 3000); // Check every 3 seconds
        poll(); // Initial check

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
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

    // (Removed handleAccept and handleDecline as CallProvider handles it)

    return (
        <NotificationContext.Provider value={{ sendSignal, onlineStatus: isOnline }}>
            {children}

            {/* Global Toasts / Popups */}
            <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {notifications.map((notif) => (
                        <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/40 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-start gap-4 min-w-[320px] max-w-sm relative overflow-hidden group"
                        >
                            {/* Decorative gradient bar */}
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
                                <h4 className="text-slate-900 font-bold text-[15px] mb-0.5">
                                    {notif.sender}
                                </h4>
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
