"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, Loader2 } from 'lucide-react';

interface LocationPickerProps {
    onLocationSet?: (lat: number, lng: number) => void;
}

export default function LocationPicker({ onLocationSet }: LocationPickerProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Initial check on mount to see if user has location in profile
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                // Check in profile (some apps nest it)
                const profile = user.profile || {};
                if (profile.latitude && profile.longitude) {
                    setCoords({ lat: profile.latitude, lng: profile.longitude });
                    setStatus('success');
                }
            } catch (e) {
                console.error("Error parsing user for location check:", e);
            }
        }
    }, []);

    const getLocation = () => {
        setLoading(true);
        setStatus('idle');

        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            setLoading(false);
            setStatus('error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const userStr = localStorage.getItem('user');
                if (!userStr) {
                    setLoading(false);
                    return;
                }
                const { username } = JSON.parse(userStr);

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

                    // Update local state
                    setCoords({ lat: latitude, lng: longitude });
                    setStatus('success');
                    
                    // Update localStorage so it persists on reload
                    const user = JSON.parse(userStr);
                    if (!user.profile) user.profile = {};
                    user.profile.latitude = latitude;
                    user.profile.longitude = longitude;
                    localStorage.setItem('user', JSON.stringify(user));

                    if (onLocationSet) onLocationSet(latitude, longitude);
                } catch (err) {
                    console.error("Location update error:", err);
                    setStatus('error');
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                setLoading(false);
                setStatus('error');
                alert("Permission denied. Please allow location access to use distance filtering.");
            },
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="relative group flex items-center">
            <button
                onClick={getLocation}
                disabled={loading}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300
                    ${status === 'success' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' 
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'}
                    disabled:opacity-50 disabled:cursor-wait
                    backdrop-blur-md relative z-10
                `}
            >
                {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                    <MapPin className="w-3.5 h-3.5" />
                )}
                
                <span className="text-xs font-bold uppercase tracking-wider">
                    {loading ? 'Transmitting...' : 
                     status === 'success' ? 'Location Set' : 
                     status === 'error' ? 'Location Error' : 'Set My Location'}
                </span>

                {status === 'success' && coords && !loading && (
                    <span className="text-[10px] opacity-60 font-mono hidden sm:inline border-l border-emerald-200 pl-2">
                        {coords.lat.toFixed(2)}, {coords.lng.toFixed(2)}
                    </span>
                )}
            </button>
            
            {/* Subtle glow effect when active */}
            {status === 'success' && (
                <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse z-0" />
            )}

            {/* Tooltip for re-updating */}
            {status === 'success' && !loading && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-50 shadow-lg font-medium">
                    New place? Click to update location
                </div>
            )}
        </div>
    );
}
