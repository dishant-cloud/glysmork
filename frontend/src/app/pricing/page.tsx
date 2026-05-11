"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import Script from 'next/script';
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

interface Plan {
    id: number;
    name: string;
    price: number;
    duration_days: number;
    features: string[];
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PricingPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<number | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        const loadPlans = async () => {
            try {
                const data = await fetchApi('/wallet/plans/');
                setPlans(data);
            } catch (error) {
                console.error("Failed to load plans:", error);
            } finally {
                setIsFetching(false);
            }
        };
        loadPlans();
    }, []);

    const handleSubscribe = async (plan: Plan) => {
        setIsLoading(plan.id);
        try {
            // 1. Create Order on Backend
            const orderData = await fetchApi('/wallet/order/create/', {
                method: 'POST',
                body: JSON.stringify({ 
                    item_type: 'SUBSCRIPTION',
                    item_id: plan.id 
                })
            });

            // 2. Open Razorpay Modal
            const options = {
                // Hardcoding the live key to avoid .env.local test key interference
                key: 'rzp_live_SmZthQ4ktSlNh6',
                amount: orderData.amount,
                currency: orderData.currency,
                name: "Glysmork",
                description: `Upgrade to ${plan.name} Plan`,
                order_id: orderData.order_id,
                handler: async function (response: any) {
                    // 3. Verify Payment on Backend
                    try {
                        setIsLoading(plan.id);
                        await fetchApi('/wallet/order/verify/', {
                            method: 'POST',
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });
                        router.push('/pricing/success');
                    } catch (err) {
                        console.error("Verification failed:", err);
                        alert("Payment verification failed. Please contact support.");
                    } finally {
                        setIsLoading(null);
                    }
                },
                prefill: {
                    name: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).username : "",
                    email: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).email : "",
                },
                theme: {
                    color: "#06b6d4",
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                alert(`Payment failed: ${response.error.description}`);
            });
            rzp.open();

        } catch (error) {
            console.error("Subscription Error:", error);
            alert("Failed to initiate payment. Please ensure you are logged in.");
        } finally {
            setIsLoading(null);
        }
    };

    const getIcon = (name: string) => {
        if (name.toLowerCase().includes('weekly')) return <Clock className="w-6 h-6 text-cyan-400" />;
        if (name.toLowerCase().includes('monthly')) return <Calendar className="w-6 h-6 text-amber-400" />;
        return <Crown className="w-6 h-6 text-purple-400" />;
    };

    const getColor = (idx: number) => {
        const colors = [
            'from-cyan-500/20 to-blue-500/20',
            'from-amber-500/20 to-orange-500/20',
            'from-purple-500/20 to-pink-500/20'
        ];
        return colors[idx % colors.length];
    };

    const getBorder = (idx: number) => {
        const borders = [
            'border-cyan-500/30',
            'border-amber-500/30',
            'border-purple-500/30'
        ];
        return borders[idx % borders.length];
    };

    return (
        <div className="min-h-screen bg-[#0a0f18] text-white selection:bg-cyan-500/30 font-sans overflow-x-hidden">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
            
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
                {isFetching ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                        {plans.map((plan, idx) => (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`relative group bg-slate-900/40 backdrop-blur-xl border ${getBorder(idx)} rounded-[32px] p-6 md:p-10 flex flex-col h-full shadow-2xl overflow-hidden`}
                            >
                                {idx === 1 && (
                                    <div className="absolute top-0 right-0 pt-6 pr-6">
                                        <div className="bg-amber-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">
                                            Most Popular
                                        </div>
                                    </div>
                                )}

                                {/* Background Glow */}
                                <div className={`absolute -top-24 -left-24 w-64 h-64 bg-gradient-to-br ${getColor(idx)} blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity`} />

                                <div className="relative space-y-6 flex-grow">
                                    <div className="p-3 bg-white/5 rounded-2xl w-fit border border-white/10">
                                        {getIcon(plan.name)}
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                                        <div className="flex items-baseline gap-2 mt-2">
                                            <span className="text-4xl font-bold tracking-tight">₹{plan.price}</span>
                                            <span className="text-slate-500 text-sm font-medium">/ {plan.duration_days} days</span>
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
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={isLoading !== null}
                                        className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${
                                            idx === 1 
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:scale-[1.02] hover:shadow-[0_10px_30px_-5px_rgba(245,158,11,0.3)]' 
                                            : 'bg-white text-black hover:scale-[1.02] hover:shadow-[0_10px_30px_-5px_rgba(255,255,255,0.1)]'
                                        } disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed`}
                                    >
                                        {isLoading === plan.id ? 'Connecting...' : 'Get Started'}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Trust Badges */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-16 flex flex-wrap justify-center gap-8 text-slate-500"
                >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        Secure Payment
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <Zap className="w-4 h-4" />
                        Instant Activation
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                        <Calendar className="w-4 h-4" />
                        Automated Tracking
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
