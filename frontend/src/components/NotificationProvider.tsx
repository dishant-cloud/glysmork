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
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Incoming call state
    const [incomingCall, setIncomingCall] = useState<{
        caller_username: string;
        room_id: string;
        mode: string;
    } | null>(null);

    useEffect(() => {
        // Only connect if user is logged in
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');

        if (!token || !userStr) return;

        let user;
        try {
            user = JSON.parse(userStr);
        } catch {
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = process.env.NEXT_PUBLIC_API_URL
            ? new URL(process.env.NEXT_PUBLIC_API_URL).host
            : '127.0.0.1:8000';

        // Connect to the generic notifications channel
        const connect = () => {
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/notifications/?token=${token}`);

            ws.onopen = () => {
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

                    if (data.type === 'incoming_call') {
                        setIncomingCall({
                            caller_username: data.caller_username,
                            room_id: data.room_id,
                            mode: data.mode
                        });
                    } else if (data.type === 'call_declined') {
                        // A custom event we can listen to elsewhere if we want to dismiss outgoing rings
                        window.dispatchEvent(new CustomEvent('call_declined'));
                    } else if (data.type === 'call_accepted') {
                        // For the caller side
                        window.dispatchEvent(new CustomEvent('call_accepted', { detail: data.room_id }));
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onclose = () => {
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
            wsRef.current.send(JSON.stringify({ type, ...payload }));
        } else {
            console.warn("Cannot send signal, WS not open");
        }
    };

    const handleAccept = () => {
        if (!incomingCall) return;
        // We don't strictly *need* to send accept signal back right now, because 
        // we'll just join the room, but it's good UX for the caller to know immediately
        sendSignal('accept_call', {
            room_id: incomingCall.room_id,
            caller_username: incomingCall.caller_username // Just info
        });

        // Redirect to room
        window.location.href = `/chat/room?id=${incomingCall.room_id}&mode=${incomingCall.mode}`;
        setIncomingCall(null);
    };

    const handleDecline = () => {
        if (!incomingCall) return;
        // Here we'd need the caller ID ideally, but since we don't have it easily right now,
        // we could just let them timeout, or we can add caller_id to the incoming_call payload later.
        setIncomingCall(null);
    };

    return (
        <NotificationContext.Provider value={{ sendSignal, onlineStatus: isOnline }}>
            {children}

            {/* Global Incoming Call Modal */}
            <AnimatePresence>
                {incomingCall && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 50 }}
                        className="fixed bottom-6 right-6 z-[9999] bg-slate-900 border-2 border-cyan-500 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.3)] p-6 w-80 overflow-hidden"
                    >
                        {/* Background scanline effect */}
                        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/50 blur-[2px] animate-pulse" />

                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-full flex items-center justify-center text-white font-black text-2xl mb-4 border border-cyan-300 shadow-lg animate-bounce">
                                {incomingCall.caller_username.charAt(0).toUpperCase()}
                            </div>

                            <h3 className="text-white font-black uppercase tracking-widest text-lg mb-1">
                                Incoming Connection
                            </h3>
                            <p className="text-cyan-400 font-mono text-xs mb-6">
                                Node: <span className="text-white bg-white/10 px-1 py-0.5 rounded">{incomingCall.caller_username}</span>
                                <br />
                                Mode: {incomingCall.mode.toUpperCase()}
                            </p>

                            <div className="flex w-full gap-3">
                                <button
                                    onClick={handleDecline}
                                    className="flex-1 py-3 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/50 text-red-400 rounded-xl transition-all flex items-center justify-center"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleAccept}
                                    className="flex-[2] py-3 bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest border border-green-400 rounded-xl transition-all shadow-[0_0_15px_rgba(74,222,128,0.4)] flex justify-center items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Accept
                                    {incomingCall.mode === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </NotificationContext.Provider>
    );
}
