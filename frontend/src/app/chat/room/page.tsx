"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MoreVertical, Trash2, Download, Check, CheckCheck } from 'lucide-react';
import Logo from '@/components/Logo';

export default function ChatRoom() {
    const [messages, setMessages] = useState([
        { id: 1, sender: 'Nero', text: 'The analysis concluded we have an 89% match on dark triad traits.', isRead: true, deletedForEveryone: false },
        { id: 2, sender: 'Match', text: 'I saw that. It noted my Machiavellianism perfectly complements your Narcissism. Intriguing.', isRead: true, deletedForEveryone: false },
        { id: 3, sender: 'Nero', text: 'Indeed. Shall we verify if the AI was correct in reality?', isRead: false, deletedForEveryone: false }
    ]);
    const [inputText, setInputText] = useState('');
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputText.trim()) return;

        const newMsg = {
            id: Date.now(),
            sender: 'Nero',
            text: inputText,
            isRead: false,
            deletedForEveryone: false
        };

        setMessages(prev => [...prev, newMsg]);
        setInputText('');

        // Simulate other person reading it
        setTimeout(() => {
            setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, isRead: true } : m));
        }, 3000);
    };

    const handleDelete = (id: number, forEveryone: boolean) => {
        if (forEveryone) {
            setMessages(prev => prev.map(m => m.id === id ? { ...m, deletedForEveryone: true, text: "This message was deleted." } : m));
        } else {
            setMessages(prev => prev.filter(m => m.id !== id));
        }
        setActiveMenu(null);
    };

    const downloadTranscript = () => {
        // In production, this points to: /api/room/[roomId]/transcript/
        const transcriptText = messages.map(m => `[Time] ${m.sender}: ${m.text}`).join('\n');
        const blob = new Blob([transcriptText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Profound_Transcript_${Date.now()}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
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
                        <h2 className="font-semibold text-white">Profound Match #892</h2>
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
                        const isMe = msg.sender === 'Nero';

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
