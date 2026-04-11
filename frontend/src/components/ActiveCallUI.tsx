"use client";

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCall } from './CallProvider';

export default function ActiveCallUI() {
    const { 
        callState, 
        duration, 
        isMuted, 
        isRemoteMuted, 
        toggleMute, 
        endCall, 
        remoteStream, 
        localStream,
        incomingCallData 
    } = useCall();
    
    // Media Refs
    const audioRef = useRef<HTMLAudioElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (remoteStream) {
            if (incomingCallData?.mode === 'video' && remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            } 
            // Fallback for audio mode or if video wasn't hooked
            if (incomingCallData?.mode !== 'video' && audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                audioRef.current.play().catch(e => console.error("Audio play failed", e));
            }
        }
    }, [remoteStream, incomingCallData?.mode, callState]);

    useEffect(() => {
        if (localStream && incomingCallData?.mode === 'video' && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, incomingCallData?.mode, callState]);

    if ((callState !== 'connected' && callState !== 'calling') || !incomingCallData) return null;
    
    // Do not show the global active call UI if we are on the video-match page (it has its own UI)
    if (typeof window !== 'undefined' && window.location.pathname === '/video-match') return null;

    const formattedDuration = callState === 'calling' 
        ? "DIALING..." 
        : `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

    const isVideo = incomingCallData.mode === 'video';

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-[#fafaf9] flex flex-col items-center justify-center overflow-hidden"
            >
                {!isVideo && <audio ref={audioRef} autoPlay />}

                {/* Ambient background */}
                <div className="absolute inset-0 top-[10%] left-[20%] w-[600px] h-[600px] bg-white/60 blur-[150px] rounded-full mix-blend-overlay pointer-events-none z-10" />
                <div className={`absolute inset-0 bg-gradient-to-br from-[#dcedec]/50 via-white/50 to-[#fadac0]/50 pointer-events-none z-10 ${isVideo ? 'opacity-40' : ''}`} />

                {/* Video Streams Container */}
                {isVideo && (
                    <div className="absolute inset-0 z-0 bg-black">
                        {/* Remote Video (Full Screen) */}
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover" 
                        />
                        
                        {/* Local Video (Floating PiP) */}
                        <div className="absolute top-8 right-8 w-32 h-44 bg-slate-900 border-4 border-white rounded-[24px] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] z-20">
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="w-full h-full object-cover -scale-x-100" 
                            />
                        </div>
                    </div>
                )}

                <div className={`relative z-20 flex flex-col items-center flex-1 justify-center w-full max-w-md px-6 ${isVideo ? 'justify-end pb-32' : ''}`}>
                    
                    {/* Remote User Profile (Only for Audio or Loading Video) */}
                    {(!isVideo || callState === 'calling') && (
                        <div className="relative mb-8">
                            {incomingCallData.caller_image_url ? (
                                <img 
                                    src={incomingCallData.caller_image_url} 
                                    alt={incomingCallData.caller_username}
                                    className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]"
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-slate-900 flex items-center justify-center text-white text-4xl font-black border-4 border-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]">
                                    {incomingCallData.caller_username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {/* Remote Mute Indicator */}
                            <AnimatePresence>
                                {isRemoteMuted && (
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                        className="absolute -bottom-2 -right-2 bg-rose-500 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md"
                                    >
                                        <MicOff className="w-5 h-5 text-white" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {(!isVideo || callState === 'calling') && (
                        <h2 className="text-3xl font-black text-slate-900 tracking-wider uppercase mb-2">
                            {incomingCallData.caller_username}
                        </h2>
                    )}
                    
                    <div className={`text-[15px] font-medium flex items-center gap-3 bg-white shadow-sm px-6 py-2.5 rounded-full border border-slate-200/80 ${isVideo && callState === 'connected' ? 'absolute top-8 left-8 text-slate-800' : 'mb-12 text-slate-600'}`}>
                        {isVideo && callState === 'connected' && (
                            <span className="text-slate-900 text-sm tracking-widest uppercase mr-3 font-bold">{incomingCallData.caller_username}</span>
                        )}
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        {formattedDuration}
                        {isVideo && isRemoteMuted && <MicOff className="w-4 h-4 text-rose-500 ml-3 animate-pulse" />}
                    </div>

                    {/* Controls */}
                    <div className={`flex items-center justify-center gap-8 ${isVideo ? 'absolute bottom-8 bg-white/90 px-10 py-5 rounded-full backdrop-blur-2xl border border-slate-200/60 shadow-xl' : 'mt-8'}`}>
                        <button 
                            onClick={toggleMute}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-rose-50 text-rose-500 border border-rose-200 shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'}`}
                        >
                            {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                        </button>
                        
                        <button 
                            onClick={endCall}
                            className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md transition-all transform hover:scale-105"
                        >
                            <PhoneOff className="w-8 h-8" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
