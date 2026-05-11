"use client";

import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { Crown, Sparkles, Gem, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

const PLANS = [
    { id: 1, name: 'Weekly', duration: 7, price: 99, discount: '' },
    { id: 2, name: 'Monthly', duration: 30, price: 299, discount: '24% off' },
    { id: 3, name: '3 Months', duration: 90, price: 699, discount: '40% off' },
    { id: 4, name: '6 Months', duration: 180, price: 1199, discount: '50% off' },
    { id: 5, name: 'Yearly', duration: 365, price: 1999, discount: '60% off', recommended: true },
];



export default function WalletPage() {
    const [loading, setLoading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => setScriptLoaded(true);
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    const handlePayment = async (type: 'SUBSCRIPTION', itemId: number) => {
        if (!scriptLoaded) {
            alert('Payment gateway is still loading. Please try again in a second.');
            return;
        }

        setLoading(true);
        try {
            // 1. Create order on backend
            const orderRes = await fetchApi('/wallet/order/create/', {
                method: 'POST',
                body: JSON.stringify({ item_type: type, item_id: itemId })
            });

            if (!orderRes.order_id) {
                alert('Could not initialize transaction');
                setLoading(false);
                return;
            }

            // 2. Open Razorpay Checkouot
            const options = {
                key: "rzp_live_SmZthQ4ktSlNh6", // Must match backend live key
                amount: orderRes.amount,
                currency: orderRes.currency,
                name: "Glysmork AI",
                description: "Premium Subscription",
                order_id: orderRes.order_id,
                handler: async function (response: any) {
                    try {
                        const verifyRes = await fetchApi('/wallet/order/verify/', {
                            method: 'POST',
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });
                        alert(verifyRes.status || "Purchase successful!");
                        window.location.reload();
                    } catch (e) {
                        alert("Verification failed. Please contact support.");
                    }
                },
                prefill: {
                    name: "Glysmork User",
                },
                theme: {
                    color: "#0f172a"
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                alert("Payment Failed: " + response.error.description);
            });
            rzp.open();
            
        } catch (error) {
            console.error("Payment error:", error);
            alert("An error occurred during payment setup.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-20 pb-24 px-4 bg-[url('/noise.png')]">
            <div className="max-w-4xl mx-auto space-y-16">
                
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Upgrade Your Connection Engine</h1>
                    <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base font-medium">
                        Free accounts get <strong className="text-slate-800">4 AI Searches</strong> and <strong className="text-slate-800">20 Roulette Matches</strong> per day. Subscribing gives you up to 100 searches and unlimited Roulette matching.
                    </p>
                </div>

                {/* Subscriptions */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <Crown className="w-6 h-6 text-indigo-500" />
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Premium Plans</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        {PLANS.map((plan) => (
                            <div 
                                key={plan.id}
                                className={`relative flex flex-col p-6 rounded-3xl border transition-all ${plan.recommended ? 'bg-slate-900 text-white shadow-xl scale-105 border-slate-900 z-10' : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'}`}
                            >
                                {plan.recommended && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest text-white shadow-sm flex items-center gap-1 w-max">
                                        <Sparkles className="w-3 h-3" /> Best Value
                                    </div>
                                )}
                                <h3 className={`text-lg font-bold ${plan.recommended ? 'text-slate-200' : 'text-slate-500'} uppercase tracking-tight`}>{plan.name}</h3>
                                <div className="mt-4 mb-2 flex items-baseline gap-1">
                                    <span className="text-3xl font-black">₹{plan.price}</span>
                                </div>
                                {plan.discount && (
                                    <div className={`text-xs font-bold mb-6 ${plan.recommended ? 'text-amber-400' : 'text-green-600'}`}>
                                        {plan.discount}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={() => handlePayment('SUBSCRIPTION', plan.id)}
                                    disabled={loading}
                                    className={`mt-auto py-3 rounded-xl font-bold text-sm transition-transform active:scale-95 ${plan.recommended ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                                >
                                    Select Plan
                                </button>
                            </div>
                        ))}
                    </div>
                </section>



            </div>
        </div>
    );
}
