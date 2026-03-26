"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ShieldAlert, Phone } from 'lucide-react';
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

    // Guard: if user already completed onboarding, skip to dashboard. Otherwise fire opening question.
    useEffect(() => {
        const username = getUsername();

        const fireOpener = () => {
            if (didInit.current) return;
            didInit.current = true;
            askAI('', []);
        };

        if (!username) {
            // No username in storage — just fire the opening question
            fireOpener();
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
            className="min-h-screen flex flex-col items-center justify-between bg-black text-white relative overflow-hidden"
            style={{ backgroundImage: `url('/glysmork_signup.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Header */}
            <div className="relative z-10 w-full max-w-2xl px-4 pt-8 pb-4 flex flex-col items-center">
                <h1 className="text-2xl font-bold tracking-[0.2em] flex gap-1 mb-4">
                    {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((l, i) => (
                        <span key={i} className={`transition-all duration-300 inline-block ${i === activeIndex
                                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 text-3xl -translate-y-2'
                                : 'text-gray-500'
                            }`}>{l}</span>
                    ))}
                </h1>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6 }}
                    />
                </div>
                <p className="text-xs font-mono text-gray-500 mt-1 self-end">{step}/{totalSteps} answered</p>
            </div>

            {/* Chat */}
            <div className="relative z-10 flex-1 w-full max-w-2xl px-4 py-4 flex flex-col gap-3 overflow-y-auto">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'model' && (
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-base mr-2 mt-1 flex-shrink-0 ${msg.isCrisis
                                        ? 'bg-red-500/20 border-red-400/40 text-red-400'
                                        : 'bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border-cyan-400/30'
                                    }`}>
                                    {msg.isCrisis ? '🆘' : '✦'}
                                </div>
                            )}
                            <div className={`max-w-[80%] px-5 py-3 text-sm leading-relaxed font-light whitespace-pre-line ${msg.role === 'user'
                                    ? 'bg-white/10 border border-white/15 text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm backdrop-blur-md'
                                    : msg.isCrisis
                                        ? 'bg-red-500/10 border border-red-400/30 text-red-100 rounded-r-2xl rounded-tl-2xl rounded-bl-sm backdrop-blur-md'
                                        : 'bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-400/20 text-gray-100 rounded-r-2xl rounded-tl-2xl rounded-bl-sm backdrop-blur-md'
                                }`}>
                                {msg.text}
                            </div>
                        </motion.div>
                    ))}

                    {/* Typing indicator */}
                    {loading && !isAnalyzing && (
                        <motion.div
                            key="typing"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex justify-start items-center gap-2"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-400/30 flex items-center justify-center text-base flex-shrink-0">✦</div>
                            <div className="flex gap-1.5 px-4 py-3 bg-cyan-500/10 border border-cyan-400/20 rounded-r-2xl rounded-tl-2xl">
                                {[0, 1, 2].map(i => (
                                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ===== CRISIS CTA BUTTONS ===== */}
                {inCrisis && !loading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col sm:flex-row gap-3 mt-2 px-2"
                    >
                        <a
                            href="tel:9152987821"
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/20 border border-red-400/40 text-red-300 rounded-xl font-mono text-sm hover:bg-red-500/30 transition-all"
                        >
                            <Phone className="w-4 h-4" /> Call iCall: 9152987821
                        </a>
                        <button
                            onClick={() => { setInCrisis(false); window.location.href = '/dashboard?support=1'; }}
                            className="flex-1 py-3 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-xl font-mono text-sm hover:bg-indigo-500/30 transition-all"
                        >
                            💙 Talk to a real person on GLYSMORK
                        </button>
                    </motion.div>
                )}
                {/* ============================= */}

                {/* Analyzing screen */}
                <AnimatePresence>
                    {isAnalyzing && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-16 gap-4"
                        >
                            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                            <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-green-400 to-purple-500">
                                Building Your AI Profile...
                            </h2>
                            <p className="text-gray-400 font-mono text-xs text-center max-w-xs">
                                Generating your soul image and psychological profile.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cap detected */}
                {capDetected && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-900/30 border border-red-500/40 rounded-2xl p-6 text-center"
                    >
                        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold text-white mb-2">CAP DETECTED.</h2>
                        <p className="text-gray-400 text-sm mb-4">{capDetected}</p>
                        <button
                            onClick={() => { setCapDetected(null); setMessages([]); setStep(0); setInCrisis(false); didInit.current = false; setTimeout(() => { didInit.current = true; askAI('', []); }, 0); }}
                            className="px-6 py-3 bg-red-900/40 hover:bg-red-800/60 border border-red-500/50 text-white font-bold rounded-full transition-all"
                        >
                            Be Real. Start Over.
                        </button>
                    </motion.div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input bar — hidden during analyzing or after final question */}
            {!isAnalyzing && !capDetected && !finalQuestion && (
                <div className="relative z-10 w-full max-w-2xl px-4 pb-8">
                    <div className="flex gap-3 bg-white/5 border border-white/15 backdrop-blur-xl rounded-2xl p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={inCrisis ? "You can still type how you're feeling..." : "Type your answer..."}
                            disabled={loading}
                            autoFocus
                            className="flex-1 bg-transparent text-white placeholder-gray-500 font-light text-sm px-3 focus:outline-none disabled:opacity-40"
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                        >
                            <ArrowRight className="w-4 h-4 text-white" />
                        </motion.button>
                    </div>
                    <p className="text-center text-[10px] text-gray-600 font-mono mt-2">Press Enter or → to answer</p>
                </div>
            )}
        </div>
    );
}
