"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Settings, X, EyeOff, ShieldCheck, Bot, ArrowRight, Zap, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { fetchApi } from '@/lib/api';

const QUICK_INTENTS = [
    "Someone who understands startups",
    "I want to discuss philosophy",
    "A chill person to vent to",
    "Someone who knows machine learning",
    "A creative writer to bounce ideas off",
    "Someone going through a breakup",
];

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [intent, setIntent] = useState('');

    // Mock User Data
    const user = {
        username: "Nero",
        profile_public: true,
        show_ai_analysis: true
    };

    const startMatching = async (searchIntent?: string) => {
        const finalIntent = searchIntent || intent;
        if (!finalIntent.trim()) return;

        setIsMatching(true);
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: finalIntent })
            });

            if (response.match_found || response.room_name) {
                // If match found immediately
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                // If added to loop, we can wait or show a message
                // For now, we'll just alert that they are in the queue
                alert("Searching for the perfect match. You'll be notified once someone fitting your intent is found.");
                setIsMatching(false);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
            alert("Failed to initiate matchmaking. Please try again.");
        }
    };

    return (
        <div className="min-h-screen p-6 md:p-12 relative">
            {/* Background */}
            <div className="fixed inset-0 bg-background -z-20" />
            <div className="fixed top-0 left-0 w-[50vw] h-[50vh] bg-purple-900/10 blur-[120px] rounded-full -z-10" />

            {/* Header */}
            <header className="flex justify-between items-center mb-16">
                <div className="flex items-center gap-6">
                    <Logo size="md" />
                    <div className="h-8 w-px bg-white/10" />
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center border border-white/10 text-sm">
                            <span className="font-bold">N</span>
                        </div>
                        <div>
                            <h2 className="font-semibold text-sm">{user.username}</h2>
                            <p className="text-[10px] text-green-400">Verified & Analyzed</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowSettings(true)}
                    className="p-3 rounded-full hover:bg-white/5 transition-colors"
                >
                    <Settings className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />
                </button>
            </header>

            {/* Main Action Area */}
            <main className="flex flex-col items-center justify-center mt-10">

                <AnimatePresence mode="wait">
                    {!isMatching ? (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center w-full max-w-2xl"
                        >
                            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Who do you need?
                            </h1>
                            <p className="text-gray-500 text-center mb-10 max-w-md">
                                Describe the kind of person, topic, or expertise you&apos;re looking for. The system will find them.
                            </p>

                            {/* Search Input */}
                            <div className="w-full relative mb-8">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    value={intent}
                                    onChange={(e) => setIntent(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && startMatching()}
                                    placeholder="e.g. &quot;Someone who understands quantum physics&quot; or &quot;A founder who failed and rebuilt&quot;"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-20 text-white text-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-600"
                                />
                                <button
                                    onClick={() => startMatching()}
                                    disabled={!intent.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:bg-gray-700 text-white font-medium flex items-center gap-2 transition-all"
                                >
                                    <Zap className="w-4 h-4" /> Find
                                </button>
                            </div>

                            {/* Quick Intent Tags */}
                            <div className="flex flex-wrap gap-2 justify-center mb-16">
                                {QUICK_INTENTS.map((qi, i) => (
                                    <motion.button
                                        key={i}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.05 * i }}
                                        onClick={() => { setIntent(qi); startMatching(qi); }}
                                        className="px-4 py-2 rounded-full glass-panel text-sm text-gray-400 hover:text-white hover:border-purple-500/30 transition-all cursor-pointer"
                                    >
                                        {qi}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="searching"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center"
                        >
                            {/* Radar/Pulse animation */}
                            <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                                <motion.div
                                    animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                                    className="absolute inset-0 rounded-full border border-purple-500/50"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: 0.5, ease: "easeOut" }}
                                    className="absolute inset-4 rounded-full border border-blue-500/50"
                                />
                                <div className="w-16 h-16 rounded-full bg-purple-600/50 flex items-center justify-center glass-panel z-10">
                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                </div>
                            </div>

                            <h2 className="text-2xl font-light tracking-widest uppercase text-purple-300">Scanning Network</h2>
                            <p className="mt-2 text-gray-500 text-center max-w-sm">
                                &ldquo;{intent}&rdquo;
                            </p>
                            <p className="mt-4 text-gray-600 font-mono text-xs">Cross-referencing profiles, expertise, interests, psychology...</p>

                            <button
                                onClick={() => setIsMatching(false)}
                                className="mt-12 px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Improvement Bot Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 w-full max-w-lg"
                >
                    <Link href="/improve">
                        <div className="glass-panel p-6 hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-emerald-500/10 hover:border-emerald-500/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center border border-emerald-500/20">
                                        <Bot className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white group-hover:text-emerald-300 transition-colors">Improvement Bot</h3>
                                        <p className="text-xs text-gray-500">AI-powered coaching based on your analysis</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    </Link>
                </motion.div>
            </main>

            {/* Privacy Settings Overlay */}
            <AnimatePresence>
                {showSettings && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => setShowSettings(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full md:w-96 glass-panel border-r-0 border-t-0 border-b-0 rounded-none z-50 p-6 flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-semibold flex items-center gap-2">
                                    <ShieldCheck className="w-6 h-6 text-purple-400" /> Privacy
                                </h2>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 space-y-8 overflow-y-auto pr-2 pb-8">

                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium">Discoverable</span>
                                        <div className="w-12 h-6 bg-purple-600 rounded-full p-1 cursor-pointer">
                                            <div className="w-4 h-4 rounded-full bg-white transform translate-x-6" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">Allow the system to match you with people seeking someone like you.</p>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium text-red-300">Expose AI Analysis</span>
                                        <div className="w-12 h-6 bg-red-600/50 rounded-full p-1 cursor-pointer border border-red-500/30">
                                            <div className="w-4 h-4 rounded-full bg-white transform translate-x-6 shadow-[0_0_10px_red]" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">Let connections see your AI-generated psychological assessment.</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Granular Field Control</h3>
                                    <div className="space-y-2">
                                        {['Interests', 'Expertise', 'Psychology', 'Conversation Topics', 'Location'].map(field => (
                                            <div key={field} className="flex justify-between items-center py-2 border-b border-white/5">
                                                <span className="text-sm">{field}</span>
                                                <button className="text-gray-500 hover:text-white">
                                                    <EyeOff className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
