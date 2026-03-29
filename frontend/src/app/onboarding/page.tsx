"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ShieldAlert, Phone, Sparkles } from 'lucide-react';
import { fetchApi } from '@/lib/api';

type Message = { role: 'model' | 'user'; text: string; isCrisis?: boolean };

export default function OnboardingChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [inCrisis, setInCrisis] = useState(false);
    const [finalQuestion, setFinalQuestion] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [capDetected, setCapDetected] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
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

    // Force background on html/body to prevent "white bleed" or cutoffs during overscroll
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const originalHtmlBg = html.style.backgroundColor;
        const originalHtmlBgImg = html.style.backgroundImage;
        const originalHtmlBgSize = html.style.backgroundSize;
        const originalHtmlBgPos = html.style.backgroundPosition;
        const originalHtmlBgAttachment = html.style.backgroundAttachment;
        const orgBodyBgImg = body.style.backgroundImage;
        const orgBodyBgSize = body.style.backgroundSize;
        const orgBodyBgPos = body.style.backgroundPosition;
        const orgBodyBgColor = body.style.backgroundColor;
        const orgBodyBgAttachment = body.style.backgroundAttachment;
        
        html.style.backgroundColor = '#050508';
        html.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url('/glysmork_signup.png')";
        html.style.backgroundSize = "cover";
        html.style.backgroundPosition = "center";
        html.style.backgroundAttachment = 'fixed';
        html.style.overscrollBehavior = 'none';

        body.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url('/glysmork_signup.png')";
        body.style.backgroundSize = "cover";
        body.style.backgroundPosition = "center";
        body.style.backgroundColor = '#050508';
        body.style.backgroundAttachment = 'fixed';
        body.style.overscrollBehavior = 'none';
        
        return () => {
            html.style.backgroundColor = originalHtmlBg;
            html.style.backgroundImage = originalHtmlBgImg;
            html.style.backgroundSize = originalHtmlBgSize;
            html.style.backgroundPosition = originalHtmlBgPos;
            html.style.backgroundAttachment = originalHtmlBgAttachment;
            html.style.overscrollBehavior = '';

            body.style.backgroundImage = orgBodyBgImg;
            body.style.backgroundSize = orgBodyBgSize;
            body.style.backgroundPosition = orgBodyBgPos;
            body.style.backgroundColor = orgBodyBgColor;
            body.style.backgroundAttachment = orgBodyBgAttachment;
            body.style.overscrollBehavior = '';
        };
    }, []);

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

        fetch(`http://127.0.0.1:8000/api/users/profile/${username}/`)
            .then(r => r.ok ? r.json() : null)
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
                const res = await fetch('http://localhost:8081/onboarding/identify-buckets', {
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
            const res = await fetch('http://localhost:8081/onboarding/chat', {
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
            setMessages(prev => [...prev, { role: 'model', text: "What made you want to join GLYSMORK today?" }]);
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
        setCapDetected(null);
        try {
            // STEP 3: Extraction and saving to the FastAPI matchmaking DB
            try {
                await fetch('http://localhost:8081/onboarding/extract', {
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
                    await fetch('http://127.0.0.1:8000/api/users/onboarding/analyze/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
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
            className="min-h-screen flex flex-col items-center justify-between text-white relative overflow-hidden"
        >
            <div className="bg-noise" />

            {/* Header */}
            <div className="relative z-10 w-full max-w-2xl px-6 pt-20 pb-6 flex flex-col items-center">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center w-full"
                >
                    <h1 className="text-3xl font-black tracking-[0.3em] flex gap-1.5 mb-8 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((l, i) => (
                            <span key={i} className={`transition-all duration-500 inline-block drop-shadow-md ${i === activeIndex
                                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 scale-125 -translate-y-2'
                                    : 'text-white/30'
                                }`}>{l}</span>
                        ))}
                    </h1>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 backdrop-blur-md">
                        <motion.div
                            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        />
                    </div>
                    <div className="w-full flex justify-between items-center mt-2 px-1">
                        <span className="text-[10px] font-sans text-[13px] font-medium text-slate-800/50 uppercase tracking-widest leading-none">AI Integration Active</span>
                        <span className="text-[10px] font-sans text-[13px] font-medium text-white/30 uppercase tracking-tighter leading-none">{step} / {totalSteps} Sync Points</span>
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
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-1 shadow-lg border backdrop-blur-md transition-all duration-500 ${msg.isCrisis
                                            ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                                            : 'bg-white/80 border-slate-200/60 shadow-sm text-slate-500 group-hover:border-slate-200'
                                        }`}>
                                        {msg.isCrisis ? <ShieldAlert className="w-5 h-5 text-red-400" /> : <Sparkles className="w-4 h-4 text-slate-400 animate-pulse" />}
                                    </div>
                                )}
                                
                                <div className={`relative px-5 py-4 text-[15px] leading-relaxed transition-all duration-300 ${msg.role === 'user'
                                        ? 'bg-cyan-500/10 border border-cyan-500/30 text-white rounded-2xl rounded-tr-none shadow-[0_4px_20px_rgba(34,211,238,0.1)]'
                                        : msg.isCrisis
                                            ? 'bg-red-500/10 border border-red-500/30 text-red-50 rounded-2xl rounded-tl-none'
                                            : 'bg-white/70 backdrop-blur-2xl border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] text-gray-100 rounded-2xl rounded-tl-none hover:border-white/20'
                                    }`}>
                                    {msg.text}
                                    {/* Subtle highlight for user messages */}
                                    {msg.role === 'user' && (
                                        <div className="absolute top-0 right-0 w-full h-full rounded-2xl bg-gradient-to-tr from-transparent via-transparent to-cyan-400/5 pointer-events-none" />
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
                            <div className="w-9 h-9 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm flex items-center justify-center text-slate-500 backdrop-blur-md">
                                <Loader2 className="w-4 h-4 animate-spin shadow-cyan-500" />
                            </div>
                            <div className="bg-white/70 backdrop-blur-2xl border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] px-5 py-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-2 items-center">
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <motion.span animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-purple-400" />
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
                            <div className="text-center">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 mb-2">
                                    Synthesizing Persona
                                </h2>
                                <p className="text-white/40 font-sans text-[13px] font-medium text-[10px] uppercase tracking-[0.2em]">Neural Architect at work</p>
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
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur opacity-25 group-focus-within:opacity-100 transition duration-500" />
                        <div className="relative flex items-center gap-4 bg-[#0a0a0f]/80 backdrop-blur-2xl border border-slate-200/60 shadow-sm rounded-2xl p-2.5 pl-5 focus-within:border-slate-200 transition-all duration-300">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder={inCrisis ? "Express your thoughts freely..." : "Feed the engine..."}
                                disabled={loading}
                                autoFocus
                                className="flex-1 bg-transparent text-white placeholder-white/20 font-light text-[15px] focus:outline-none disabled:opacity-40"
                            />
                            <motion.button
                                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(34,211,238,0.4)" }} 
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:grayscale shadow-lg"
                            >
                                <ArrowRight className="w-5 h-5 text-white" />
                            </motion.button>
                        </div>
                    </motion.div>
                    <p className="text-center text-[9px] text-white/20 font-sans text-[13px] font-medium mt-4 uppercase tracking-[0.3em] font-black">Neural Link Established</p>
                </div>
            )}
        </div>
    );
}
