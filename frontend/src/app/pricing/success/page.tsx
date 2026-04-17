"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Rocket } from 'lucide-react';
import Logo from '@/components/Logo';

export default function PricingSuccess() {
    const router = useRouter();

    useEffect(() => {
        // We could verify the session here with the backend if we wanted to show more details
        // but the webhook will handle the activation.
        const timer = setTimeout(() => {
            router.push('/dashboard');
        }, 5000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen bg-[#0a0f18] text-white flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
            <div className="fixed top-[20%] left-[10%] w-[400px] h-[400px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 space-y-8 max-w-md w-full"
            >
                <div className="flex justify-center mb-8">
                    <Logo />
                </div>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-cyan-500/30 rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                        <Sparkles className="w-5 h-5 text-amber-400 opacity-50" />
                    </div>
                    
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-cyan-500/10 rounded-full border border-cyan-500/20 mb-6">
                        <CheckCircle className="w-10 h-10 text-cyan-400" />
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight mb-2">Payment Successful!</h1>
                    <p className="text-slate-400 font-medium">
                        Welcome to the Inner Circle. Your account has been upgraded to Premium.
                    </p>

                    <div className="mt-10 py-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Initial Activation</p>
                        <div className="flex items-center justify-center gap-2 text-cyan-400">
                            <Rocket className="w-4 h-4" />
                            <span className="text-sm font-bold">Pro Features Enabled</span>
                        </div>
                    </div>

                    <p className="mt-10 text-xs text-slate-500 font-medium">
                        Redirecting you to the dashboard in a few seconds...
                    </p>
                </div>

                <button 
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-cyan-500 font-semibold hover:text-cyan-400 transition-colors"
                >
                    Go back now
                </button>
            </motion.div>
        </div>
    );
}
