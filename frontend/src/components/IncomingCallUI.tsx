"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X } from 'lucide-react';
import { useCall } from './CallProvider';

export default function IncomingCallUI() {
    const { callState, incomingCallData, acceptCall, declineCall } = useCall();

    // Do not show the incoming call UI if we are on the video-match page (it handles auto-accept)
    if (typeof window !== 'undefined' && window.location.pathname === '/video-match') return null;

    if (callState !== 'ringing' || !incomingCallData) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-white/80 backdrop-blur-3xl flex flex-col items-center justify-center overflow-hidden"
            >
                {/* Visual pulse effect for ringing */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-[100px] animate-pulse" />
                </div>

                <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6 text-center">
                    <motion.div 
                        animate={{ y: [0, -15, 0] }} 
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="mb-8"
                    >
                        {incomingCallData.caller_image_url ? (
                            <img 
                                src={incomingCallData.caller_image_url} 
                                alt={incomingCallData.caller_username}
                                className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)]"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-slate-900 flex items-center justify-center text-white text-4xl font-black border-4 border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)]">
                                {incomingCallData.caller_username.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </motion.div>

                    <h3 className="text-slate-500 text-[13px] font-bold uppercase tracking-widest mb-2">
                        Incoming {incomingCallData.mode} Call
                    </h3>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-wider mb-6">
                        {incomingCallData.caller_username}
                    </h2>

                    {incomingCallData.caller_interests && incomingCallData.caller_interests.length > 0 && (
                        <div className="mb-12">
                            <p className="text-slate-500 font-medium text-sm mb-3">Shared Interests</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {incomingCallData.caller_interests.slice(0, 3).map(interest => (
                                    <span key={interest} className="px-3 py-1 bg-white border border-slate-200/60 shadow-sm rounded-full text-xs font-semibold text-slate-600">
                                        {interest}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-12 mt-8">
                        <button 
                            onClick={declineCall}
                            className="flex flex-col items-center gap-3 group"
                        >
                            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center transition-all group-hover:bg-rose-500 group-hover:text-white shadow-sm">
                                <X className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest group-hover:text-rose-600">Decline</span>
                        </button>
                        
                        <button 
                            onClick={acceptCall}
                            className="flex flex-col items-center gap-3 group"
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] transition-all transform group-hover:scale-110">
                                <Phone className="w-8 h-8 fill-current" />
                            </div>
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest group-hover:text-emerald-600">Accept</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
