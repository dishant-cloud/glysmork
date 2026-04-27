"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { 
    Check, 
    Zap, 
    ShieldCheck, 
    Crown, 
    Sparkles, 
    ChevronLeft,
    Clock,
    Calendar
} from 'lucide-react';
import Logo from '@/components/Logo';

export default function PricingPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const plans = [
        {
            id: 'weekly',
            name: 'Weekly Pass',
            price: '$5.99',
            duration: 'per week',
            icon: <Clock className="w-6 h-6 text-cyan-400" />,
            features: [
                'Unlimited Matches',
                'Priority Discovery',
                'Ad-free Experience',
                'Pro Badge on Profile',
                'Weekly AI Insight Report'
            ],
            color: 'from-cyan-500/20 to-blue-500/20',
            borderColor: 'border-cyan-500/30'
        },
        {
            id: 'monthly',
            name: 'Monthly Pro',
            price: '$19.99',
            duration: 'per month',
            icon: <Crown className="w-6 h-6 text-amber-400" />,
            features: [
                'All Weekly Features',
                'Unlimited AI Analysis',
                'Exclusive "Incognito" Mode',
                'Direct DM to Any Profile',
                'Save 20% vs Weekly'
            ],
            recommended: true,
            color: 'from-amber-500/20 to-orange-500/20',
            borderColor: 'border-amber-500/30'
        }
    ];

    const handleSubscribe = async (planType: string) => {
        setIsLoading(planType);
        try {
            const data = await fetchApi('/users/subscription/checkout/', {
                method: 'POST',
                body: JSON.stringify({ plan_type: planType })
            });

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("Checkout URL not received.");
            }
        } catch (error) {
            console.error("Subscription Error:", error);
            alert("Failed to initiate checkout. Please ensure you are logged in.");
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f18] text-white selection:bg-cyan-500/30 font-sans overflow-x-hidden">
            {/* Fluid Background Elements */}
            <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none animate-pulse" />
            <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none" />

            {/* Navigation */}
            <nav className="relative z-50 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Dashboard</span>
                </button>
                <div className="scale-90 opacity-80">
                    <Logo />
                </div>
                <div className="w-24" /> {/* Spacer */}
            </nav>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col items-center">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4 mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                        <Sparkles className="w-3 h-3" />
                        Premium Experience
                    </div>
                    <h1 className="text-3xl md:text-6xl font-bold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                        Unlock Your Full Potential
                    </h1>
                    <p className="max-w-xl mx-auto text-slate-400 text-lg leading-relaxed">
                        Join our premium network to access deep AI insights, unlimited matching, and prioritized discovery.
                    </p>
                </motion.div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
                    {plans.map((plan, idx) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`relative group bg-slate-900/40 backdrop-blur-xl border ${plan.borderColor} rounded-[32px] p-6 md:p-10 flex flex-col h-full shadow-2xl overflow-hidden`}
                        >
                            {plan.recommended && (
                                <div className="absolute top-0 right-0 pt-6 pr-6">
                                    <div className="bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">
                                        Best Value
                                    </div>
                                </div>
                            )}

                            {/* Background Glow */}
                            <div className={`absolute -top-24 -left-24 w-64 h-64 bg-gradient-to-br ${plan.color} blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity`} />

                            <div className="relative space-y-6 flex-grow">
                                <div className="p-3 bg-white/5 rounded-2xl w-fit border border-white/10">
                                    {plan.icon}
                                </div>
                                
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                                        <span className="text-slate-500 text-sm font-medium">{plan.duration}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 w-full" />

                                <ul className="space-y-4">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                            <div className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-cyan-400" />
                                            </div>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-10 relative">
                                <button
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={isLoading !== null}
                                    className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${
                                        plan.recommended 
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:scale-[1.02] hover:shadow-[0_10px_30px_-5px_rgba(245,158,11,0.3)]' 
                                        : 'bg-white text-black hover:scale-[1.02] hover:shadow-[0_10px_30px_-5px_rgba(255,255,255,0.1)]'
                                    } disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed`}
                                >
                                    {isLoading === plan.id ? 'Initiating...' : 'Get Access Now'}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Trust Badges */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-16 flex flex-wrap justify-center gap-8 text-slate-500"
                >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        Secure Checkout
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <Zap className="w-4 h-4" />
                        Instant Activation
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <Calendar className="w-4 h-4" />
                        Cancel Anytime
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
