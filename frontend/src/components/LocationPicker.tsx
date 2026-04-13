"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface LocationPickerProps {
    onLocationSet?: (lat: number, lng: number) => void;
}

export default function LocationPicker({ onLocationSet }: LocationPickerProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                const profile = user.profile || {};
                if (profile.latitude && profile.longitude) {
                    setCoords({ lat: profile.latitude, lng: profile.longitude });
                    setStatus('success');
                }
            } catch (e) {
                console.error("Error parsing user for location check:", e);
            }
        }

        // Always check and refresh location automatically via geolocation API
        if (navigator.geolocation && !hasFetched.current) {
            hasFetched.current = true;
            setStatus('loading');
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const uStr = localStorage.getItem('user');
                    if (!uStr) {
                        setStatus('error');
                        return;
                    }
                    const { username } = JSON.parse(uStr);

                    try {
                        const { fetchApi } = await import('@/lib/api');
                        await fetchApi('/matchmaking/update-location/', {
                            method: 'POST',
                            body: JSON.stringify({
                                username,
                                latitude,
                                longitude
                            })
                        });

                        setCoords({ lat: latitude, lng: longitude });
                        setStatus('success');
                        
                        const updatedUser = JSON.parse(uStr);
                        if (!updatedUser.profile) updatedUser.profile = {};
                        updatedUser.profile.latitude = latitude;
                        updatedUser.profile.longitude = longitude;
                        localStorage.setItem('user', JSON.stringify(updatedUser));

                        if (onLocationSet) onLocationSet(latitude, longitude);
                    } catch (err) {
                        console.error("Location update error:", err);
                        setStatus('error');
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    setStatus('error');
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
        } else if (!navigator.geolocation) {
            setStatus('error');
        }
    }, [onLocationSet]);

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 border border-slate-200/50 rounded-full shadow-sm text-slate-500 backdrop-blur-sm">
            {status === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
            ) : status === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : status === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
                <MapPin className="w-3.5 h-3.5" />
            )}
            
            <span className="text-[10px] font-bold uppercase tracking-wider">
                {status === 'loading' ? 'Syncing Location...' : 
                 status === 'success' && coords ? `Location Synced` : 
                 status === 'error' ? 'Location Disabled' : 'Location'}
            </span>
        </div>
    );
}

