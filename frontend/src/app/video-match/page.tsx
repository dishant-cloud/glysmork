"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, PhoneOff, RotateCcw, ArrowLeft, UserPlus, Check } from 'lucide-react';
import { useCall } from '@/components/CallProvider';
import { fetchApi } from '@/lib/api';

type Phase = 'searching' | 'connecting' | 'connected' | 'ended';

export default function VideoMatchPage() {
    const { 
        localStream, 
        remoteStream, 
        callState, 
        duration,
        isRemoteMuted,
        endCall, 
        startCall, 
        acceptCall, 
        isMuted, 
        toggleMute 
    } = useCall();

    const [phase, setPhase] = useState<Phase>('searching');
    const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
    const [cameraOn, setCameraOn] = useState(true);
    const [targetGender, setTargetGender] = useState<string | null>(null);
    const [friendRequested, setFriendRequested] = useState(false);

    // Get gender from URL on mount (client-side only)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setTargetGender(params.get('gender') || 'A');
    }, []);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const localCameraRef = useRef<MediaStream | null>(null);

    // Get own username
    const getUsername = () => {
        try { return JSON.parse(localStorage.getItem('user') || '{}').username; } catch { return null; }
    };

    // Start local camera preview immediately on mount
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localCameraRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Camera access denied', err);
            }
        };
        startCamera();

        return () => {
            // Stop the preview stream on unmount (CallProvider will manage its own stream)
            localCameraRef.current?.getTracks().forEach(t => t.stop());
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // Mirror CallProvider's localStream into the local video element once the call starts
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Mirror remoteStream into the remote video element
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            setPhase('connected');
        }
    }, [remoteStream]);

    // When callState changes, update phase
    useEffect(() => {
        if (callState === 'connected') setPhase('connected');
        if (callState === 'calling') setPhase('connecting');
        if (callState === 'ringing') {
            // Auto-accept if we get an incoming call while on this page
            console.log("Auto-accepting incoming call with existing stream...");
            acceptCall(localCameraRef.current || undefined);
        }
        if (callState === 'ended' || callState === 'idle') {
            if (phase === 'connected') setPhase('ended');
            if (phase === 'connecting') {
                // Connection failed or timed out
                setPhase('searching');
                startSearching();
            }
        }
    }, [callState]);

    // Safety timeout for connection
    useEffect(() => {
        if (phase === 'connecting') {
            const timer = setTimeout(() => {
                if (callState !== 'connected') {
                    console.log("Connection timed out, returning to search");
                    endCall();
                }
            }, 15000); // 15 seconds before giving up
            return () => clearTimeout(timer);
        }
    }, [phase, callState, endCall]);

    const handleFriendRequest = async () => {
        if (!partnerUsername || friendRequested) return;
        try {
            await fetchApi('/matchmaking/friends/', {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'request', 
                    target_username: partnerUsername,
                    username: getUsername()
                })
            });
            setFriendRequested(true);
            setTimeout(() => setFriendRequested(false), 3000); // Reset after 3s
        } catch (err) {
            console.error('Failed to send friend request', err);
        }
    };

    // Begin polling for a match
    const startSearching = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase('searching');
        setFriendRequested(false);
        setPartnerUsername(null);

        const params = new URLSearchParams(window.location.search);
        const genderFilter = params.get('gender') || 'A';
        const intentText = 'Random Opposite Gender video';
        const username = getUsername();

        const tryMatch = async () => {
            try {
                const response = await fetchApi('/matchmaking/join/', {
                    method: 'POST',
                    body: JSON.stringify({
                        intent: intentText,
                        username,
                        mode: 'video',
                        gender_filter: genderFilter,
                    }),
                });

                if (response.match_found || response.room_name || response.status === 'match_found') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setPhase('connecting');
                    const partner = response.matched_user || response.matched_username; // Handle varied backend keys
                    if (!partner) return;
                    
                    setPartnerUsername(partner);
                    
                    // Note: We no longer stop preview tracks here. We pass them to CallProvider for re-use.

                    // DESIGNATED CALLER LOGIC: Only the alphabetically "greater" username initiates
                    // This prevents "glare" (both users calling each other)
                    const isCaller = username > partner;
                    
                    if (isCaller) {
                        console.log(`[ROULETTE] I am the designated caller for ${partner}. Re-using stream...`);
                        setTimeout(() => {
                            startCall(partner, 'video', response.room_name, localCameraRef.current || undefined);
                        }, 500);
                    } else {
                        console.log(`[ROULETTE] I am the receiver for ${partner}. Waiting for call...`);
                        // Auto-accept useEffect handles the incoming call
                    }
                }
            } catch { /* keep polling */ }
        };

        tryMatch();
        pollRef.current = setInterval(tryMatch, 3000);
    }, [startCall]);

    // Start polling on mount
    useEffect(() => {
        startSearching();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const handleEnd = () => {
        endCall();
        if (pollRef.current) clearInterval(pollRef.current);
        localCameraRef.current?.getTracks().forEach(t => t.stop());
        window.location.href = '/dashboard';
    };

    const handleNext = () => {
        endCall();
        if (pollRef.current) clearInterval(pollRef.current);
        startSearching();
    };

    const toggleCamera = () => {
        const stream = localCameraRef.current || localStream;
        stream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
        setCameraOn(prev => !prev);
    };

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col overflow-hidden font-outfit">
            {/* Remote video — full screen */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${phase === 'connected' ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
            />

            {/* Top Info Bar (Only when connected) */}
            <AnimatePresence>
                {phase === 'connected' && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="absolute top-6 left-6 right-6 z-40 flex justify-between items-start"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-white font-bold tracking-wide uppercase text-sm">
                                    {partnerUsername || 'Connected'}
                                </span>
                            </div>
                            {isRemoteMuted && (
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex items-center gap-2 bg-rose-500/20 backdrop-blur-md px-3 py-1 rounded-xl border border-rose-500/30 w-fit"
                                >
                                    <MicOff className="w-3 h-3 text-rose-500" />
                                    <span className="text-rose-500 text-[10px] font-bold uppercase tracking-tighter">Partner Muted</span>
                                </motion.div>
                            )}
                        </div>

                        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl text-white font-mono text-sm tracking-widest">
                            {formatDuration(duration)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Searching overlay */}
            <AnimatePresence>
                {(phase === 'searching' || phase === 'connecting') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/60 backdrop-blur-sm"
                    >
                        <div className="relative w-24 h-24">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 rounded-full border-2 border-white/30"
                                    animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                                    transition={{ duration: 2.2, delay: i * 0.7, repeat: Infinity }}
                                />
                            ))}
                            <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
                                <Video className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        <p className="text-white font-black text-xl tracking-[0.2em] uppercase">
                            {phase === 'connecting' ? 'Establishing Neural link...' : 'Finding your match...'}
                        </p>
                        <p className="text-white/40 text-xs tracking-widest uppercase font-bold">
                            Target: {targetGender === 'M' ? 'MALES' : targetGender === 'F' ? 'FEMALES' : 'ANYONE'}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ended overlay */}
            <AnimatePresence>
                {phase === 'ended' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80"
                    >
                        <p className="text-white text-2xl font-bold">Call Ended</p>
                        <div className="flex gap-4">
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 transition-all"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Find Next
                            </button>
                            <button
                                onClick={handleEnd}
                                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-full font-semibold text-sm border border-white/20 hover:bg-white/20 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Leave
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Local video — PiP bottom right */}
            <div className="absolute bottom-24 right-4 z-30 w-36 h-24 md:w-48 md:h-32 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover scale-x-[-1] ${cameraOn ? '' : 'opacity-0'}`}
                />
                {!cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                        <VideoOff className="w-6 h-6 text-white/40" />
                    </div>
                )}
            </div>

            {/* Controls bar */}
            <div className="absolute bottom-6 left-0 right-0 z-30 flex items-center justify-center gap-4">
                {/* Mute */}
                <button
                    onClick={toggleMute}
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Camera toggle */}
                <button
                    onClick={toggleCamera}
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                >
                    {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>

                {/* End call */}
                <button
                    onClick={phase === 'connected' ? handleNext : handleEnd}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-all"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>

                {/* Back */}
                <button
                    onClick={handleEnd}
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Friend Request (Only when connected) */}
                <AnimatePresence>
                    {phase === 'connected' && (
                        <motion.button
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            onClick={handleFriendRequest}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${friendRequested ? 'bg-emerald-500 text-white' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'}`}
                        >
                            {friendRequested ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
