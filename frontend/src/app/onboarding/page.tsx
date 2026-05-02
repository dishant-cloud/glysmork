"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ShieldAlert, Phone, Sparkles } from 'lucide-react';
import { fetchApi } from '@/lib/api';

type Message = { role: 'model' | 'user'; text: string; isCrisis?: boolean };

const getOnboardingUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.')) {
            return process.env.NEXT_PUBLIC_ONBOARDING_URL || 'https://api.glysmork.com';
        }
    }
    return process.env.NEXT_PUBLIC_ONBOARDING_URL || 'http://localhost:8081';
};

const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.')) {
            return (process.env.NEXT_PUBLIC_API_URL || 'https://api.glysmork.com/api').replace('/api', '');
        }
    }
    return (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace('/api', '');
};

const ONBOARDING_URL = getOnboardingUrl();
const API_BASE = getApiBaseUrl();

export default function OnboardingChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [inCrisis, setInCrisis] = useState(false);
    const [finalQuestion, setFinalQuestion] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [capDetected, setCapDetected] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const didInit = useRef(false); // prevent React StrictMode double-call

    // GLYSMORK letter animation
    useEffect(() => {
        const interval = setInterval(() => setActiveIndex(p => (p + 1) % 8), 1000);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Legacy full-screen background effect removed in favor of clean component styling.

    // Guard: if user already completed onboarding, skip to dashboard. Otherwise fire opening question.
    useEffect(() => {
        const username = getUsername();

        const fireOpener = () => {
            if (didInit.current) return;
            didInit.current = true;
            askAI('', []);
        };

        if (!username) {
            window.location.href = '/login';
            return;
        }

        // Allow retake if ?retake=true is in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const isRetake = urlParams.get('retake') === 'true';

        fetchApi(`/users/profile/${username}/`)
            .then(data => {
                if (!isRetake && data?.psychological_profile && Object.keys(data.psychological_profile).length > 0) {
                    // Profile already built — no need to redo onboarding
                    window.location.href = '/dashboard';
                } else {
                    fireOpener();
                }
            })
            .catch(() => fireOpener());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getUsername = () => {
        try { return JSON.parse(localStorage.getItem('user') || '{}')?.username ?? null; }
        catch { return null; }
    };

    const askAI = async (userMsg: string, currentMsgs: Message[]) => {
        setLoading(true);
        try {
            // STEP 1: If it's the very first message
            if (step === 1 && userMsg) {
                const res = await fetch(`${ONBOARDING_URL}/onboarding/identify-buckets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 1, // Fallback ID for testing until auth passes real IDs
                        opening_answer: userMsg
                    })
                });
                const data = await res.json();
                console.log("Bucket Identification:", data);
                // We'll let the chat endpoint use default rules for now to keep things simple
            }

            // STEP 2: The Chat Conversation
            const res = await fetch(`${ONBOARDING_URL}/onboarding/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: 1, // Fallback ID
                    message: userMsg,
                    conversation_history: currentMsgs.map(m => ({ role: m.role, content: m.text })),
                })
            });
            const data = await res.json();

            if (data.is_complete) {
                const closing = "Thanks for being so open. I have everything I need to build your profile now.";
                setFinalQuestion(closing);
                const withClosing: Message[] = [...currentMsgs, { role: 'model', text: closing }];
                setMessages(withClosing);
                setTimeout(() => buildProfile(withClosing), 1200);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting. Please wait a moment and try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userText = input.trim();
        setInput('');
        setInCrisis(false);

        const userMsg: Message = { role: 'user', text: userText };
        const newMsgs = [...messages, userMsg];
        setMessages(newMsgs);
        const newStep = step + 1;
        setStep(newStep);

        await askAI(userText, newMsgs);
    };

    const buildProfile = async (msgs: Message[]) => {
        setIsAnalyzing(true);
        try {
            // STEP 3: Extraction and saving to the FastAPI matchmaking DB
            try {
                await fetch(`${ONBOARDING_URL}/onboarding/extract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 1, // Fallback user_id for test
                        full_conversation_history: msgs.map(m => ({ role: m.role, content: m.text }))
                    })
                });
            } catch (extractErr) {
                console.error('FastAPI extraction failed (non-blocking):', extractErr);
            }

            // STEP 4: Generate psychological profile & persona image in the Django DB
            // This populates the profile page with core_traits, attachment_style, etc.
            const username = getUsername();
            if (username) {
                const conversationAnswers: Record<string, string> = {};
                msgs.forEach((m, idx) => {
                    if (m.role === 'user') {
                        conversationAnswers[`q${idx}`] = m.text;
                    }
                });

                try {
                    await fetchApi(`/users/onboarding/analyze/`, {
                        method: 'POST',
                        body: JSON.stringify({
                            username: username,
                            answers: conversationAnswers,
                            connection_preferences: {},
                            interests: [],
                            expertise: []
                        })
                    });
                } catch (analyzeErr) {
                    console.error('Django profile analysis failed:', analyzeErr);
                }
            }

            window.location.href = '/dashboard';
        } catch (err: any) {
            window.location.href = '/dashboard';
        } finally {
            setIsAnalyzing(false);
        }
    };


    const totalSteps = 6;
    const progressPct = Math.min(100, Math.round((step / totalSteps) * 100));

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#dcedec] via-[#f5f3ed] to-[#fadac0] text-slate-900 font-sans"
        >
            {/* Ambient Background Glows */}
            <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-white/60 blur-[150px] rounded-full mix-blend-overlay pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-100/50 blur-[120px] rounded-full mix-blend-overlay pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 w-full max-w-2xl px-6 pt-20 pb-6 flex flex-col items-center">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center w-full"
                >
                    <h1 className="text-3xl font-black tracking-[0.3em] flex gap-1.5 mb-8">
                        {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((l, i) => (
                            <span key={i} className={`transition-all duration-500 inline-block ${i === activeIndex
                                    ? 'text-cyan-600 scale-125 -translate-y-1'
                                    : 'text-slate-400'
                                }`}>{l}</span>
                        ))}
                    </h1>
                    <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden border border-white/60 shadow-inner">
                        <motion.div
                            className="h-full bg-cyan-500 shadow-sm"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        />
                    </div>
                    <div className="w-full flex justify-between items-center mt-2 px-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">AI Integration Active</span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter leading-none">{step} / {totalSteps} Sync Points</span>
                    </div>
                </motion.div>
            </div>

            {/* Chat Area */}
            <div className="relative z-10 flex-1 w-full max-w-2xl px-6 py-4 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
                <AnimatePresence initial={false} mode="popLayout">
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex items-end gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                {msg.role === 'model' && (
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-1 shadow-sm border bg-white/90 border-slate-200 transition-all duration-500 ${msg.isCrisis
                                            ? 'bg-red-50 border-red-200 text-red-500 animate-pulse'
                                            : 'text-cyan-600'
                                        }`}>
                                        {msg.isCrisis ? <ShieldAlert className="w-5 h-5" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
                                    </div>
                                )}
                                
                                <div className={`relative px-5 py-4 text-[15px] leading-relaxed transition-all duration-300 font-medium ${msg.role === 'user'
                                        ? 'bg-slate-900 border border-slate-800 text-white rounded-2xl rounded-tr-none shadow-[0_10px_30px_rgba(15,23,42,0.15)]'
                                        : msg.isCrisis
                                            ? 'bg-red-50 border border-red-200 text-red-700 rounded-2xl rounded-tl-none shadow-sm'
                                            : 'bg-white/80 backdrop-blur-2xl border border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] text-slate-800 rounded-2xl rounded-tl-none'
                                    }`}>
                                    {msg.text}
                                    {/* Subtle highlight for user messages */}
                                    {msg.role === 'user' && (
                                        <div className="absolute top-0 right-0 w-full h-full rounded-2xl bg-gradient-to-tr from-transparent via-transparent to-white/5 pointer-events-none" />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {/* AI Thinking Animation */}
                    {loading && !isAnalyzing && (
                        <motion.div
                            key="typing"
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0 }}
                            className="flex justify-start items-center gap-3"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-cyan-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                            <div className="bg-white/80 backdrop-blur-2xl border border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] px-5 py-4 rounded-2xl rounded-tl-none flex gap-2 items-center">
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Processing State */}
                <AnimatePresence>
                    {isAnalyzing && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-12 gap-6"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-500/20 blur-2xl animate-pulse rounded-full" />
                                <Loader2 className="w-16 h-16 text-slate-500 animate-spin relative z-10" />
                            </div>
                            <div className="text-center mt-4">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 mb-2">
                                    Synthesizing Persona
                                </h2>
                                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-[0.2em]">Neural Architect at work</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error/Cap State */}
                {capDetected && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/70 backdrop-blur-2xl border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] border border-red-500/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.1)]"
                    >
                        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase italic">Inconsistency Detected</h2>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed font-light">{capDetected}</p>
                        <button
                            onClick={() => { setCapDetected(null); setMessages([]); setStep(0); setInCrisis(false); didInit.current = false; setTimeout(() => { didInit.current = true; askAI('', []); }, 0); }}
                            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-600/20"
                        >
                            Restart Synapse
                        </button>
                    </motion.div>
                )}

                <div ref={bottomRef} className="h-4" />
            </div>

            {/* Input Unit */}
            {!isAnalyzing && !capDetected && !finalQuestion && (
                <div className="relative z-10 w-full max-w-2xl px-6 pb-12">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-100 rounded-3xl blur opacity-50 group-focus-within:opacity-100 transition duration-500" />
                        <div className="relative flex items-center gap-4 bg-white/80 backdrop-blur-2xl border border-white/80 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] rounded-full p-2.5 pl-6 focus-within:border-slate-300 transition-all duration-300">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder={inCrisis ? "Express your thoughts freely..." : "Feed the engine..."}
                                disabled={loading}
                                autoFocus
                                className="flex-1 bg-transparent text-slate-900 font-medium placeholder-slate-400 text-[15px] focus:outline-none disabled:opacity-40"
                            />
                            <motion.button
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center disabled:opacity-30 disabled:grayscale shadow-md hover:shadow-lg transition-all"
                            >
                                <ArrowRight className="w-5 h-5 text-white" />
                            </motion.button>
                        </div>
                    </motion.div>
                    <p className="text-center text-[10px] text-slate-400 font-semibold mt-4 uppercase tracking-[0.3em]">Neural Link Established</p>
                </div>
            )}
        </div>
    );
}
