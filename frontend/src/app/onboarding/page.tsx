"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldAlert, Loader2, ChevronRight } from 'lucide-react';
import Logo from '@/components/Logo';
import { fetchApi } from '@/lib/api';

const QUESTIONS = [
    { id: 'q1', category: 'Psychology', text: "What is a truth about yourself you rarely admit to others?" },
    { id: 'q2', category: 'Psychology', text: "Describe a scenario where you justified a morally ambiguous action." },
    { id: 'q3', category: 'Interests', text: "What topics can you talk about for hours without getting bored?" },
    { id: 'q4', category: 'Expertise', text: "What do people come to YOU for advice about? What are you genuinely good at?" },
    { id: 'q5', category: 'Goals', text: "What is the one thing you are most trying to achieve or figure out right now?" },
    { id: 'q6', category: 'Connection', text: "Describe the kind of conversations that energize you vs. drain you." },
];

export default function OnboardingQuiz() {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [capDetected, setCapDetected] = useState<{ message: string } | null>(null);

    const handleNext = async () => {
        if (currentStep < QUESTIONS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            await submitAnalysis();
        }
    };

    const submitAnalysis = async () => {
        setIsAnalyzing(true);
        setCapDetected(null);

        try {
            // Send answers to the exact endpoint configured in Django
            const response = await fetchApi('/users/onboarding/', {
                method: 'POST',
                body: JSON.stringify({ answers })
            });

            // If we get here, the response was 200 OK (no cap detected)
            window.location.href = '/dashboard';
        } catch (error: any) {
            console.error(error);
            const errString = error.toString();

            // Check if the backend detected "cap" (406 Not Acceptable throws an Error object containing the JSON response string)
            if (errString.includes("cap_detected") || errString.includes("Not Acceptable")) {
                setCapDetected({ message: "Analysis detects high probability of surface-level answers. Be specific. Give real examples." });
            } else if (errString.includes("once a week") || errString.includes("Too Many Requests")) {
                setCapDetected({ message: "You can only take the deep analysis quiz once a week. Your profile is already building based on your interactions." });
            } else {
                setCapDetected({ message: "An error occurred during neural analysis. Please try again." });
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">

            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background -z-10" />

            <div className="w-full max-w-2xl">
                {/* Logo */}
                <div className="mb-8">
                    <Logo size="md" />
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
                    <motion.div
                        className="h-full bg-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>

                <AnimatePresence mode="wait">
                    {!isAnalyzing && !capDetected ? (
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.4 }}
                            className="glass-panel p-8 md:p-12"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-mono text-purple-400 tracking-widest uppercase">
                                    {QUESTIONS[currentStep].category}
                                </span>
                                <ChevronRight className="w-3 h-3 text-gray-600" />
                                <span className="text-xs font-mono text-gray-500 tracking-widest">
                                    {currentStep + 1} / {QUESTIONS.length}
                                </span>
                            </div>

                            <h1 className="text-2xl md:text-3xl font-medium mb-8 leading-tight">
                                {QUESTIONS[currentStep].text}
                            </h1>

                            <textarea
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all min-h-[150px] resize-none"
                                placeholder="Be honest and specific — generic answers get flagged..."
                                value={answers[QUESTIONS[currentStep].id] || ''}
                                onChange={e => setAnswers({ ...answers, [QUESTIONS[currentStep].id]: e.target.value })}
                                autoFocus
                            />

                            <div className="mt-8 flex justify-between items-center">
                                <span className="text-xs text-gray-600 font-mono">
                                    {(answers[QUESTIONS[currentStep].id] || '').length < 10
                                        ? `${10 - (answers[QUESTIONS[currentStep].id] || '').length} more characters needed`
                                        : '✓ Good to go'
                                    }
                                </span>
                                <button
                                    onClick={handleNext}
                                    disabled={!answers[QUESTIONS[currentStep].id] || answers[QUESTIONS[currentStep].id].length < 10}
                                    className="px-6 py-3 bg-white text-black font-medium rounded-lg flex items-center gap-2 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {currentStep === QUESTIONS.length - 1 ? 'Initiate Analysis' : 'Continue'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ) : isAnalyzing ? (
                        <motion.div
                            key="analyzing"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-20"
                        >
                            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-6" />
                            <h2 className="text-2xl font-light tracking-wide text-gray-300">Building your profile...</h2>
                            <p className="text-gray-500 mt-2 font-mono text-sm max-w-sm text-center">Mapping interests, validating expertise claims, cross-referencing psychology patterns.</p>
                        </motion.div>
                    ) : capDetected ? (
                        <motion.div
                            key="cap"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="glass-panel p-8 md:p-12 border-red-500/30 text-center"
                        >
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ShieldAlert className="w-8 h-8 text-red-400" />
                            </div>
                            <h2 className="text-3xl font-bold mb-4 text-white">Cap Detected.</h2>
                            <p className="text-gray-400 mb-8 leading-relaxed max-w-md mx-auto">{capDetected.message}</p>

                            <button
                                onClick={() => {
                                    setCapDetected(null);
                                    setCurrentStep(0);
                                }}
                                className="px-8 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-200 rounded-lg transition-colors"
                            >
                                Try Again. Be Real.
                            </button>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}
