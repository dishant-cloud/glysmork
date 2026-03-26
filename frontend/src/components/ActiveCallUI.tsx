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
                className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center overflow-hidden"
            >
                {!isVideo && <audio ref={audioRef} autoPlay />}

                {/* Scanline background */}
                <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none z-10" />
                <div className={`absolute inset-0 bg-gradient-to-b from-cyan-900/20 to-slate-900/80 pointer-events-none z-10 ${isVideo ? 'opacity-40' : ''}`} />

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
                        <div className="absolute top-8 right-8 w-32 h-44 bg-slate-900 border-2 border-cyan-500/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.3)] z-20">
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
                                    className="w-32 h-32 rounded-full border-4 border-cyan-500/50 object-cover shadow-[0_0_40px_rgba(34,211,238,0.2)]"
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white text-4xl font-black border-4 border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
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
                                        className="absolute -bottom-2 -right-2 bg-red-500 w-10 h-10 rounded-full flex items-center justify-center border-4 border-slate-950 shadow-lg"
                                    >
                                        <MicOff className="w-5 h-5 text-white" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {(!isVideo || callState === 'calling') && (
                        <h2 className="text-3xl font-black text-white tracking-wider uppercase mb-2 drop-shadow-lg">
                            {incomingCallData.caller_username}
                        </h2>
                    )}
                    
                    <div className={`text-cyan-400 font-mono text-xl flex items-center gap-3 drop-shadow-md bg-black/50 px-5 py-2 rounded-full backdrop-blur-md border border-cyan-900/50 ${isVideo && callState === 'connected' ? 'absolute top-8 left-8' : 'mb-12'}`}>
                        {isVideo && callState === 'connected' && (
                            <span className="text-white text-sm tracking-widest uppercase mr-3 font-bold">{incomingCallData.caller_username}</span>
                        )}
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                        </span>
                        {formattedDuration}
                        {isVideo && isRemoteMuted && <MicOff className="w-4 h-4 text-red-500 ml-3 animate-pulse" />}
                    </div>

                    {/* Controls */}
                    <div className={`flex items-center justify-center gap-8 ${isVideo ? 'absolute bottom-8 bg-black/60 px-10 py-5 rounded-[3rem] backdrop-blur-xl border border-white/10 shadow-2xl' : 'mt-8'}`}>
                        <button 
                            onClick={toggleMute}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
                        >
                            {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                        </button>
                        
                        <button 
                            onClick={endCall}
                            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all transform hover:scale-105"
                        >
                            <PhoneOff className="w-8 h-8" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
