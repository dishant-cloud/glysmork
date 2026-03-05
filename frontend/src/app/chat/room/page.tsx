"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MoreVertical, Trash2, Download, Check, CheckCheck } from 'lucide-react';
import Logo from '@/components/Logo';
import { fetchApi } from '@/lib/api';

interface ChatMessage {
    id: number;
    sender: string;
    text: string;
    isRead: boolean;
    deletedForEveryone: boolean;
    timestamp?: string;
}

export default function ChatRoom() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

        fetchMessages(); // Initial fetch

        const token = localStorage.getItem('access_token');
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).host : '127.0.0.1:8000';

        const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/chat/${roomId}/?token=${token}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'chat_message') {
                setMessages(prev => {
                    // Prevent duplicates if REST API was faster
                    if (prev.some(m => m.id === data.id)) return prev;

                    return [...prev, {
                        id: data.id,
                        sender: data.username,
                        text: data.message,
                        isRead: data.isRead,
                        deletedForEveryone: data.deletedForEveryone,
                        timestamp: data.timestamp
                    }];
                });
            } else if (data.type === 'message_deleted') {
                setMessages(prev => prev.map(m =>
                    m.id === data.id ? { ...m, deletedForEveryone: true, text: "This message was deleted." } : m
                ));
            } else if (data.type === 'message_read') {
                setMessages(prev => prev.map(m =>
                    m.id === data.id ? { ...m, isRead: true } : m
                ));
            }
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed.");
        };

        return () => {
            ws.close();
        };
    }, [roomId, currentUser, fetchMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputText.trim() || !roomId) return;
        const text = inputText;
        setInputText('');

        try {
            await fetchApi(`/room/${roomId}/messages/`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            // State is updated via WebSocket 'chat_message' event
        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message.");
        }
    };

    const handleDelete = async (id: number, forEveryone: boolean) => {
        setActiveMenu(null);
        try {
            const action = forEveryone ? 'delete_for_everyone' : 'delete_for_me';
            await fetchApi(`/messages/${id}/action/`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });

            // If delete_for_me, the server doesn't broadcast to everyone, so we manually remove it locally
            if (!forEveryone) {
                setMessages(prev => prev.filter(m => m.id !== id));
            }
            // For delete_for_everyone, state is updated via WebSocket 'message_deleted' event

        } catch (error) {
            console.error("Failed to delete message", error);
            alert("Failed to delete message.");
        }
    };

    const downloadTranscript = async () => {
        if (!roomId) return;
        try {
            const token = localStorage.getItem('access_token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/room/${roomId}/transcript/`, { headers });

            if (!res.ok) throw new Error("Failed to download");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Glysmork_Transcript_${roomId}.txt`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("Failed to download transcript");
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="h-16 glass-panel rounded-none border-x-0 border-t-0 flex items-center justify-between px-6 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <Logo size="sm" showText={false} />
                    <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center">
                        M
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">Profound Match</h2>
                        <p className="text-xs text-green-400 font-mono tracking-wider">SECURE CONNECTION</p>
                    </div>
                </div>

                <button
                    onClick={downloadTranscript}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
                    title="Download Transcript"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Transcript</span>
                </button>
            </header>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-900/5 blur-[100px] rounded-full pointer-events-none" />

                <div className="text-center my-8">
                    <span className="px-3 py-1 text-xs rounded-full bg-white/5 text-gray-400 font-mono border border-white/5">
                        Analysis complete. Connection established.
                    </span>
                </div>

                <AnimatePresence>
                    {messages.map((msg) => {
                        const isMe = currentUser ? msg.sender === currentUser : false;

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                layout
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                            >
                                <div className={`max-w-[75%] md:max-w-[60%] flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

                                    {/* Message Bubble */}
                                    <div className={`relative px-4 py-3 rounded-2xl ${msg.deletedForEveryone
                                        ? 'bg-transparent border border-white/10 text-gray-500 italic'
                                        : isMe
                                            ? 'bg-purple-600 text-white'
                                            : 'glass-panel text-gray-200'
                                        } ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>

                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                                        {/* Read Receipts (Only for sender) */}
                                        {isMe && !msg.deletedForEveryone && (
                                            <div className="absolute bottom-1 right-2 flex items-center gap-1 opacity-70">
                                                <span className="text-[10px]">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {msg.isRead ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3" />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Menu Trigger */}
                                    {isMe && !msg.deletedForEveryone && (
                                        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                            <button
                                                onClick={() => setActiveMenu(activeMenu === msg.id ? null : msg.id)}
                                                className="p-1 rounded hover:bg-white/10 text-gray-400"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {/* Action Dropdown */}
                                            <AnimatePresence>
                                                {activeMenu === msg.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                        className="absolute right-0 top-full mt-1 w-48 glass-panel py-1 z-20 border-white/10"
                                                    >
                                                        <button
                                                            onClick={() => handleDelete(msg.id, false)}
                                                            className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center gap-2 text-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete for me
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(msg.id, true)}
                                                            className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-400 flex items-center gap-2 text-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete for everyone
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <footer className="p-4 md:p-6 shrink-0 bg-transparent">
                <div className="max-w-4xl mx-auto relative flex items-center">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your message..."
                        className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-16 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="absolute right-2 p-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-gray-700 transition-colors flex items-center justify-center"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
                <p className="text-center text-[10px] text-gray-600 font-mono mt-3 uppercase tracking-widest">
                    A.I. Analysis passive monitoring is active.
                </p>
            </footer>
        </div>
    );
}
