"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, X, Check } from 'lucide-react';

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
        const wsHost = process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).host
            : '127.0.0.1:8000';

        // Connect to the generic notifications channel
        const connect = () => {
            window.dispatchEvent(new CustomEvent('ws_debug_sys', { detail: `Attempting WS auth with token: ${token.substring(0, 10)}...` }));
            // Add timeout for connection
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/notifications/?token=${token}`);

            ws.onopen = () => {
                window.dispatchEvent(new CustomEvent('ws_debug_sys', { detail: 'WEBSOCKET FULLY CONNECTED!' }));
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
                        // Add to pop-up notifications
                        const newNotif = {
                            id: Date.now(),
                            sender: data.sender,
                            text: data.text,
                            type: data.type === 'friend_message' ? 'Message' : 'Session'
                        };
                        setNotifications(prev => [...prev, newNotif]);
                        // Auto-remove after 5s
                        setTimeout(() => {
                            setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
                        }, 5000);
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

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
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
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 p-4 rounded-xl shadow-2xl flex items-start gap-4 min-w-[300px] max-w-sm"
                        >
                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                                <Check className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">
                                    New {notif.type}
                                </p>
                                <p className="text-white font-bold truncate">
                                    {notif.sender}
                                </p>
                                <p className="text-slate-400 text-sm line-clamp-2 italic">
                                    "{notif.text}"
                                </p>
                            </div>
                            <button 
                                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                                className="text-slate-500 hover:text-white transition-colors"
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
