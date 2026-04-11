"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNotification } from './NotificationProvider';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallContextProps {
    callState: CallState;
    remoteStream: MediaStream | null;
    localStream: MediaStream | null;
    incomingCallData: IncomingCallData | null;
    duration: number;
    isMuted: boolean;
    isRemoteMuted: boolean;
    toggleMute: () => void;
    acceptCall: (existingStream?: MediaStream) => void;
    declineCall: () => void;
    endCall: () => void;
    startCall: (targetUsername: string, mode?: 'audio' | 'video', contextId?: string, existingStream?: MediaStream) => void;
}

interface IncomingCallData {
    call_id: string;
    caller_username: string;
    caller_id: number;
    mode: 'audio' | 'video';
    sdp?: RTCSessionDescriptionInit;
    context_id?: string;
    caller_image_url?: string;
    caller_interests?: string[];
}

const CallContext = createContext<CallContextProps | null>(null);

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error("useCall must be used within CallProvider");
    return context;
};

export default function CallProvider({ children }: { children: React.ReactNode }) {
    const { sendSignal, onlineStatus } = useNotification();
    
    const [callState, setCallState] = useState<CallState>('idle');
    const callStateRef = useRef<CallState>('idle');

    // Keep ref in sync
    useEffect(() => {
        callStateRef.current = callState;
    }, [callState]);
    const [incomingCallData, setIncomingCallData] = useState<IncomingCallData | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    
    const [isMuted, setIsMuted] = useState(false);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);
    const [duration, setDuration] = useState(0);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const dataChannel = useRef<RTCDataChannel | null>(null);
    const activeCallId = useRef<string | null>(null);
    const durationTimer = useRef<NodeJS.Timeout | null>(null);
    const iceCandidatesBuffer = useRef<any[]>([]);
    
    const rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Add TURN server here if available
        ]
    };

    // Clean up connections
    const cleanupCall = () => {
        if (durationTimer.current) clearInterval(durationTimer.current);
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setCallState('idle');
        setIncomingCallData(null);
        activeCallId.current = null;
        setDuration(0);
        setIsMuted(false);
        setIsRemoteMuted(false);
        iceCandidatesBuffer.current = [];
    };

    const drainIceCandidates = async (pc: RTCPeerConnection) => {
        while (iceCandidatesBuffer.current.length > 0) {
            const candidate = iceCandidatesBuffer.current.shift();
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("[WEBRTC] Buffered ICE candidate added successfully");
            } catch (err) {
                console.error("[WEBRTC ERROR] Error adding buffered ice candidate", err);
            }
        }
    };

    const setupPeerConnection = () => {
        console.log("[WEBRTC] Setting up RTCPeerConnection with config:", rtcConfig);
        const pc = new RTCPeerConnection(rtcConfig);
        
        pc.onicecandidate = (event) => {
            console.log("[WEBRTC] ICE Candidate generated:", event.candidate ? "Yes" : "No (Gathering Complete)");
            if (event.candidate && activeCallId.current) {
                console.log("[WEBRTC] Sending ICE Candidate to backend...");
                sendSignal('ice_candidate', {
                    call_id: activeCallId.current,
                    candidate: event.candidate,
                    peer_id: incomingCallData?.caller_id // For caller to receiver, need correct peer_id
                });
            }
        };

        pc.ontrack = (event) => {
            console.log("[WEBRTC] Track received from remote peer!", event.streams[0]);
            setRemoteStream(event.streams[0]);
        };

        // Data channel for mute state
        pc.ondatachannel = (event) => {
            const channel = event.channel;
            channel.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'mute_state') {
                        setIsRemoteMuted(data.isMuted);
                    }
                } catch (err) {}
            };
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WEBRTC] ICE Connection State: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'failed') {
                console.error("[WEBRTC ERROR] ICE Connection failed. This usually means a TURN server is required for this network.");
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WEBRTC] Connection State: ${pc.connectionState}`);
            if (pc.connectionState === 'connected') {
                setCallState('connected');
            }
        };

        pc.onsignalingstatechange = () => {
            console.log(`[WEBRTC] Signaling State: ${pc.signalingState}`);
        };

        peerConnection.current = pc;
        return pc;
    };

    useEffect(() => {
        const handleIncomingCall = (e: any) => {
            console.log("[WEBRTC] Incoming Call received:", e.detail);
            const data = e.detail;
            setIncomingCallData(data);
            activeCallId.current = data.call_id;
            setCallState('ringing');
        };

        const handleCallAnswered = async (e: any) => {
            console.log("[WEBRTC] Call Answered payload received:", e.detail);
            const data = e.detail;
            if (peerConnection.current && data.sdp_answer) {
                try {
                    console.log("[WEBRTC] Setting remote description (Answer)...");
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp_answer));
                    console.log("[WEBRTC] Remote description set successfully! Call Connected.");
                    setCallState('connected');
                    // Drain any buffered ICE candidates that arrived before the answer
                    await drainIceCandidates(peerConnection.current);
                    // Start timer
                    durationTimer.current = setInterval(() => setDuration(d => d + 1), 1000);
                } catch (err) {
                    console.error("[WEBRTC ERROR] Failed to set remote description:", err);
                }
            } else {
                console.warn("[WEBRTC WARN] peerConnection is null or sdp_answer missing");
            }
        };

        const handleIceCandidate = async (e: any) => {
            console.log("[WEBRTC] Remote ICE Candidate received");
            const data = e.detail;
            if (data.call_id !== activeCallId.current) return;

            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log("[WEBRTC] Remote ICE Candidate added successfully");
                } catch (err) {
                    console.error("[WEBRTC ERROR] Error adding ice candidate", err);
                }
            } else {
                console.log("[WEBRTC] Buffering remote ICE candidate until PC is ready...");
                iceCandidatesBuffer.current.push(data.candidate);
            }
        };

        const handleCallDeclined = (e: any) => {
            console.log("[WEBRTC] Call Declined signal received, current state:", callStateRef.current);
            // If the ID matches OR if we are in a ringing/calling state, cleanup
            if (e.detail?.call_id === activeCallId.current || callStateRef.current === 'ringing' || callStateRef.current === 'calling') {
                cleanupCall();
            }
        };

        const handleCallEnded = (e: any) => {
            console.log("[WEBRTC] Call Ended signal received, current state:", callStateRef.current);
            // If the ID matches OR we are currently in an active call state, cleanup
            if (e.detail?.call_id === activeCallId.current || callStateRef.current !== 'idle') {
                cleanupCall();
            }
        };

        window.addEventListener('sys_incoming_call', handleIncomingCall);
        window.addEventListener('sys_call_answered', handleCallAnswered);
        window.addEventListener('sys_ice_candidate', handleIceCandidate);
        window.addEventListener('sys_call_declined', handleCallDeclined);
        window.addEventListener('sys_call_ended', handleCallEnded);

        return () => {
            window.removeEventListener('sys_incoming_call', handleIncomingCall);
            window.removeEventListener('sys_call_answered', handleCallAnswered);
            window.removeEventListener('sys_ice_candidate', handleIceCandidate);
            window.removeEventListener('sys_call_declined', handleCallDeclined);
            window.removeEventListener('sys_call_ended', handleCallEnded);
        };
    }, [callState]);

    const getMedia = async (mode: 'audio' | 'video' = 'audio') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: mode === 'video' 
            });
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error("Failed to get media", err);
            return null;
        }
    };

    const startCall = async (targetUsername: string, mode: 'audio'|'video' = 'audio', contextId?: string, existingStream?: MediaStream) => {
        console.log(`[WEBRTC] Initiating ${mode} call to ${targetUsername}... (Stream ${existingStream ? 'Provided' : 'Requested'})`);
        const stream = existingStream || await getMedia(mode);
        if (existingStream) setLocalStream(existingStream);
        if (!stream) {
            console.error("[WEBRTC ERROR] Could not get media stream. Call aborted.");
            return;
        }

        const pc = setupPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Create data channel
        const dc = pc.createDataChannel('controls');
        dataChannel.current = dc;

        console.log("[WEBRTC] Creating local offer...");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("[WEBRTC] Local description (Offer) set successfully.");

        // This isn't strictly necessary to have an ID here if the backend generates it, 
        // but backend accepts whatever call_id we send or generates one.
        const tempCallId = crypto.randomUUID();
        activeCallId.current = tempCallId;

        setIncomingCallData({
            call_id: tempCallId,
            caller_username: targetUsername,
            caller_id: 0,
            mode,
            context_id: contextId
        });
        setCallState('calling');

        console.log("[WEBRTC] Sending 'call_offer' signal to backend...");
        sendSignal('call_offer', {
            to_username: targetUsername,
            call_id: tempCallId,
            sdp: offer,
            mode,
            context_id: contextId
        });
    };

    const acceptCall = async (existingStream?: MediaStream) => {
        console.log(`[WEBRTC] Accepting incoming call... (Stream ${existingStream ? 'Provided' : 'Requested'})`);
        if (!incomingCallData || !incomingCallData.sdp) {
            console.error("[WEBRTC ERROR] No incoming call data or SDP available to accept!");
            return;
        }
        
        const stream = existingStream || await getMedia(incomingCallData.mode);
        if (existingStream) setLocalStream(existingStream);
        if (!stream) {
            console.error("[WEBRTC ERROR] Could not get media stream. Answer aborted.");
            return;
        }

        const pc = setupPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        
        try {
            console.log("[WEBRTC] Setting remote description (Offer)...");
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.sdp));
            console.log("[WEBRTC] Creating local answer...");
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("[WEBRTC] Local description (Answer) set. Sending 'call_answer' signal...");

            // Drain any buffered ICE candidates that arrived before we were ready
            await drainIceCandidates(pc);

            sendSignal('call_answer', {
                call_id: incomingCallData.call_id,
                sdp_answer: answer
            });

            setCallState('connected');
            durationTimer.current = setInterval(() => setDuration(d => d + 1), 1000);
        } catch (err) {
            console.error("[WEBRTC ERROR] Error during acceptCall flow:", err);
        }
    };

    const declineCall = () => {
        if (activeCallId.current) {
            sendSignal('call_decline', { call_id: activeCallId.current });
        }
        cleanupCall();
    };

    const endCall = () => {
        if (activeCallId.current) {
            sendSignal('call_end', { call_id: activeCallId.current });
        }
        cleanupCall();
    };

    const toggleMute = () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const newMutedState = !isMuted;
                audioTracks[0].enabled = !newMutedState;
                setIsMuted(newMutedState);
                
                if (dataChannel.current && dataChannel.current.readyState === 'open') {
                    dataChannel.current.send(JSON.stringify({ type: 'mute_state', isMuted: newMutedState }));
                }
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callState,
            remoteStream,
            localStream,
            incomingCallData,
            duration,
            isMuted,
            isRemoteMuted,
            toggleMute,
            acceptCall,
            declineCall,
            endCall,
            startCall
        }}>
            {children}
        </CallContext.Provider>
    );
}
