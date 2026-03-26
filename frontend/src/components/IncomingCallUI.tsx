"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X } from 'lucide-react';
import { useCall } from './CallProvider';

export default function IncomingCallUI() {
    const { callState, incomingCallData, acceptCall, declineCall } = useCall();

    if (callState !== 'ringing' || !incomingCallData) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden"
            >
                {/* Visual pulse effect for ringing */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
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
                                className="w-32 h-32 rounded-full border-4 border-cyan-500/50 object-cover shadow-[0_0_40px_rgba(34,211,238,0.4)]"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white text-4xl font-black border-4 border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                                {incomingCallData.caller_username.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </motion.div>

                    <h3 className="text-cyan-400 font-mono text-sm uppercase tracking-widest mb-2">
                        Incoming {incomingCallData.mode} Call
                    </h3>
                    <h2 className="text-4xl font-black text-white uppercase tracking-wider mb-6">
                        {incomingCallData.caller_username}
                    </h2>

                    {incomingCallData.caller_interests && incomingCallData.caller_interests.length > 0 && (
                        <div className="mb-12">
                            <p className="text-slate-400 text-sm mb-3">Shared Interests</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {incomingCallData.caller_interests.slice(0, 3).map(interest => (
                                    <span key={interest} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white">
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
                            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 text-red-500 flex items-center justify-center transition-all group-hover:bg-red-500 group-hover:text-white">
                                <X className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-red-500 uppercase tracking-widest group-hover:text-red-400">Decline</span>
                        </button>
                        
                        <button 
                            onClick={acceptCall}
                            className="flex flex-col items-center gap-3 group"
                        >
                            <div className="w-20 h-20 rounded-full bg-green-500 text-black flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all transform group-hover:scale-110">
                                <Phone className="w-8 h-8 fill-current" />
                            </div>
                            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Accept</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
