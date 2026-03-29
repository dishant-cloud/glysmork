"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, ArrowLeft, Loader2, Target, Heart, Briefcase, Brain } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { fetchApi } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'bot';
    content: string;
}

const SUGGESTIONS = [
    { icon: Brain, text: "How can I work on my attachment style?", color: "purple" },
    { icon: Heart, text: "Why do I keep attracting the wrong people?", color: "pink" },
    { icon: Briefcase, text: "I want to be more disciplined in my career.", color: "blue" },
    { icon: Target, text: "Help me set meaningful goals for this month.", color: "green" },
];

export default function ImprovementBot() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (!localStorage.getItem('user')) {
            window.location.href = '/login';
            return;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            // In production: POST /api/users/improvement-bot/
            // with { message: text, history: messages }

            // Simulated AI response delay
            try {
                // Send to real backend
                const history = messages.map(msg => ({
                    role: msg.role === 'bot' ? 'assistant' : 'user',
                    content: msg.content
                }));

                const data = await fetchApi('/users/improvement-bot/', {
                    method: 'POST',
                    body: JSON.stringify({ message: text, history })
                });

                const botMsg: Message = {
                    id: Date.now() + 1,
                    role: 'bot',
                    content: data.response
                };
                setMessages(prev => [...prev, botMsg]);
            } catch (error) {
                console.error(error);
                const botMsg: Message = {
                    id: Date.now() + 1,
                    role: 'bot',
                    content: "My systems are currently updating. Please try again shortly."
                };
                setMessages(prev => [...prev, botMsg]);
            } finally {
                setIsTyping(false);
            }
        } catch (error) {
            console.error(error);
            const errorMsg: Message = {
                id: Date.now() + 1,
                role: 'bot',
                content: "I encountered an error processing your request. Please try again."
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background relative overflow-hidden">

            {/* Ambient Background */}
            <div className="fixed top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="h-16 glass-panel rounded-none border-x-0 border-t-0 flex items-center gap-4 px-6 z-10 shrink-0">
                <Logo size="sm" showText={false} />
                <div className="h-8 w-px bg-white/10" />
                <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-white/80 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-400" />
                </Link>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white flex items-center gap-2">
                            Improvement Bot
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full border border-slate-800 font-sans text-[13px] font-medium uppercase tracking-wider">AI</span>
                        </h2>
                        <p className="text-xs text-emerald-400 font-sans text-[13px] font-medium">Uses your profile insights</p>
                    </div>
                </div>
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                {/* Empty State - Suggestions */}
                {messages.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center h-full max-w-lg mx-auto"
                    >
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center mb-6 border border-emerald-500/20">
                            <Sparkles className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-200">
                            What do you want to improve?
                        </h2>
                        <p className="text-gray-500 text-center mb-10 text-sm leading-relaxed">
                            I analyze your psychological profile, behavioral patterns, and shared experiences to give you advice no generic bot ever could.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            {SUGGESTIONS.map((s, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * i }}
                                    onClick={() => sendMessage(s.text)}
                                    className="glass-panel p-4 text-left hover:bg-white/80 transition-all hover:-translate-y-1 duration-300 flex items-start gap-3 group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color === 'purple' ? 'bg-purple-500/20' :
                                        s.color === 'pink' ? 'bg-pink-500/20' :
                                            s.color === 'blue' ? 'bg-blue-500/20' : 'bg-emerald-500/20'
                                        }`}>
                                        <s.icon className={`w-4 h-4 ${s.color === 'purple' ? 'text-purple-400' :
                                            s.color === 'pink' ? 'text-pink-400' :
                                                s.color === 'blue' ? 'text-blue-400' : 'text-emerald-400'
                                            }`} />
                                    </div>
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">{s.text}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Message Bubbles */}
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'bot'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                    : 'bg-purple-600'
                                    }`}>
                                    {msg.role === 'bot' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                                </div>

                                {/* Bubble */}
                                <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-sm'
                                    : 'glass-panel text-gray-200 rounded-bl-sm border-emerald-500/10'
                                    }`}>
                                    {msg.role === 'bot' ? (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            {msg.content.split('\n').map((line, i) => {
                                                if (line.startsWith('**') && line.endsWith('**')) {
                                                    return <p key={i} className="font-bold text-emerald-300 mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
                                                }
                                                if (line.match(/^\d+\./)) {
                                                    return <p key={i} className="ml-4 text-sm leading-relaxed mb-1">{line}</p>;
                                                }
                                                return line ? <p key={i} className="text-sm leading-relaxed mb-2">{line.replace(/\*\*/g, '')}</p> : null;
                                            })}
                                        </div>
                                    ) : (
                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                <AnimatePresence>
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="glass-panel px-5 py-3 rounded-2xl rounded-bl-sm border-emerald-500/10">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                                    <span className="text-sm text-gray-400 font-sans text-[13px] font-medium">Reflecting on your journey...</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <footer className="p-4 md:p-6 shrink-0">
                <div className="max-w-3xl mx-auto relative flex items-center">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isTyping && sendMessage(inputText)}
                        placeholder="Ask anything about self-improvement..."
                        disabled={isTyping}
                        className="w-full bg-white/80 border border-slate-200/60 shadow-sm rounded-full py-4 pl-6 pr-16 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-500 disabled:opacity-50"
                    />
                    <button
                        onClick={() => sendMessage(inputText)}
                        disabled={!inputText.trim() || isTyping}
                        className="absolute right-2 p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-gray-700 transition-colors"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
                <p className="text-center text-[10px] text-gray-600 font-sans text-[13px] font-medium mt-3 uppercase tracking-widest">
                    Powered by your psychological profile insights
                </p>
            </footer>
        </div>
    );
}
