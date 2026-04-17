"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

export default function PricingCancel() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#0a0f18] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 max-w-sm w-full"
            >
                <div className="flex justify-center mb-8 opacity-50">
                    <Logo />
                </div>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[32px] p-10 shadow-2xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
                        <XCircle className="w-8 h-8 text-red-500/80" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight mb-2">Payment Canceled</h1>
                    <p className="text-slate-400 text-sm font-medium">
                        No worries! Your account hasn't been charged. Feel free to upgrade whenever you're ready.
                    </p>

                    <button
                        onClick={() => router.push('/pricing')}
                        className="mt-8 w-full py-3.5 bg-white text-black rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] transition-transform"
                    >
                        Return to Pricing
                    </button>
                </div>

                <button 
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center justify-center gap-2 text-sm text-slate-500 font-semibold hover:text-slate-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );
}
