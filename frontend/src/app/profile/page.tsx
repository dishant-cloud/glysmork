"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, User, Activity, Edit3, Phone, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotification } from '@/components/NotificationProvider';

export default function ProfilePage() {
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [friends, setFriends] = useState<any[]>([]);
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);
    const { sendSignal } = useNotification();

    // Editable fields
    const [editBio, setEditBio] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editAge, setEditAge] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadProfile();
        loadFriends();

        const handleCallAccepted = (e: any) => {
            if (e.detail) {
                window.location.href = `/chat/room?id=${e.detail}`;
            }
        };

        const handleCallDeclined = () => {
            setRingingUsername(null);
            alert("The node declined your connection request.");
        };

        window.addEventListener('call_accepted', handleCallAccepted);
        window.addEventListener('call_declined', handleCallDeclined);

        return () => {
            window.removeEventListener('call_accepted', handleCallAccepted);
            window.removeEventListener('call_declined', handleCallDeclined);
        };
    }, []);

    const getUsername = (): string | null => {
        try {
            const u = localStorage.getItem('user');
            if (!u) return null;
            return JSON.parse(u)?.username || null;
        } catch { return null; }
    };

    const loadProfile = async () => {
        const storedUsername = getUsername();
        if (!storedUsername) {
            setError('Not logged in. Please log in first.');
            setLoading(false);
            return;
        }
        try {
            // Use public profile endpoint — no session cookie needed
            const response = await fetch(`http://127.0.0.1:8001/api/users/profile/${storedUsername}/`);

            if (!response.ok) throw new Error(`${response.status}`);
            const data = await response.json();
            setProfileData(data);
            setEditBio(data.bio || '');
            setEditGender(data.gender || 'O');
            setEditAge(data.age || '18');
        } catch (err) {
            console.error("Failed to load profile", err);
            setError('Could not load neural profile data.');
        } finally {
            setLoading(false);
        }
    };

    const loadFriends = async () => {
        try {
            const data = await fetchApi('/matchmaking/friends/');
            if (data.friends) {
                setFriends(data.friends);
            }
        } catch (err) {
            console.error("Failed to load friends", err);
        }
    };

    const handleSave = async () => {
        const storedUsername = getUsername();
        if (!storedUsername) return;
        setSaving(true);
        try {
            const data = await fetchApi(`/users/profile/${storedUsername}/`, {
                method: 'PATCH',
                body: JSON.stringify({
                    bio: editBio,
                    gender: editGender,
                    age: parseInt(editAge) || 18,
                })
            });
            setProfileData(data);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert('Failed to update profile. Make sure you are logged in.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050511] flex items-center justify-center text-cyan-500 font-mono flex-col gap-4">
                <div className="w-8 h-8 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin"></div>
                Decrypting Neural Data...
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#050511] flex flex-col items-center justify-center text-white p-8">
                <p className="text-red-400 mb-6 font-mono text-center">{error}</p>
                <Link href="/dashboard" className="px-6 py-2 border border-white/20 hover:bg-white/10 rounded-full font-mono text-sm transition-colors">
                    Return to Hub
                </Link>
            </div>
        );
    }

    const psychologicalProfile = profileData?.psychological_profile || {};

    return (
        <div className="min-h-screen bg-[#050511] text-white selection:bg-cyan-500/30 font-sans p-6 md:p-12 relative overflow-hidden pb-32">

            {/* Texture Layer */}
            <div className="bg-noise opacity-30 fixed inset-0 pointer-events-none mix-blend-overlay z-10" />

            <div className="max-w-6xl mx-auto relative z-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors font-mono text-sm uppercase px-4 py-2 border border-slate-800 rounded-full bg-black/40 backdrop-blur-md">
                        <ArrowLeft className="w-4 h-4" /> Hub
                    </Link>
                    <h1 className="text-sm font-mono tracking-[0.3em] font-bold text-slate-500 border-b border-cyan-900/50 pb-2">
                        SYS.PROFILE.DATA
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Avatar & Basic Info */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-black/60 backdrop-blur-xl border border-white/5 p-6 shadow-2xl relative overflow-hidden group"
                        >
                            {/* The Persona Image */}
                            <div className="aspect-square w-full bg-slate-900 border border-slate-800 mb-6 relative overflow-hidden flex items-center justify-center">
                                {profileData?.persona_image_url ? (
                                    <img
                                        src={profileData.persona_image_url}
                                        alt="AI Persona"
                                        className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-700 scale-105 group-hover:scale-100"
                                    />
                                ) : (
                                    <div className="text-slate-700 font-mono text-xs text-center p-4">
                                        <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        NO VISUAL ASSET<br />(Complete Onboarding)
                                    </div>
                                )}

                                <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md border border-cyan-500/30 px-2 py-1 flex items-center gap-1 font-mono text-[10px] text-cyan-400 z-10">
                                    <Activity className="w-3 h-3" /> SYS.TRUST: {profileData?.trust_score || 100}
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-500 font-mono mb-1 block">BIO</label>
                                        <textarea
                                            value={editBio}
                                            onChange={(e) => setEditBio(e.target.value)}
                                            className="w-full bg-black border border-slate-700 focus:border-cyan-500 outline-none p-3 text-sm font-mono h-24"
                                            placeholder="Write your system bio..."
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 font-mono mb-1 block">GENDER</label>
                                            <select
                                                value={editGender}
                                                onChange={(e) => setEditGender(e.target.value)}
                                                className="w-full bg-black border border-slate-700 focus:border-cyan-500 outline-none p-3 text-sm font-mono appearance-none"
                                            >
                                                <option value="M">MALE</option>
                                                <option value="F">FEMALE</option>
                                                <option value="O">OTHER</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 font-mono mb-1 block">AGE</label>
                                            <input
                                                type="number"
                                                value={editAge}
                                                onChange={(e) => setEditAge(e.target.value)}
                                                className="w-full bg-black border border-slate-700 focus:border-cyan-500 outline-none p-3 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex-1 bg-cyan-900/40 hover:bg-cyan-800 text-cyan-100 font-mono text-xs py-2 border border-cyan-500/50 transition-colors"
                                        >
                                            {saving ? 'SAVING...' : 'SAVE'}
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs py-2 border border-slate-600 transition-colors"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-2xl font-black uppercase tracking-wider">{profileData?.user?.username}</h2>
                                            <div className="text-xs font-mono text-slate-500 flex gap-2 mt-1">
                                                <span>{profileData?.gender === 'M' ? 'MALE' : profileData?.gender === 'F' ? 'FEMALE' : 'OTHER'}</span>
                                                <span>•</span>
                                                <span>AGE {profileData?.age}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-slate-500 hover:text-white transition-colors"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="text-sm text-slate-300 leading-relaxed font-mono mt-6 border-l-2 border-slate-700 pl-4 py-1">
                                        {profileData?.bio || <span className="text-slate-600 italic">No biographical data found.</span>}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Right Column: AI Analysis */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-cyan-950/20 border border-cyan-900/50 p-8 shadow-2xl relative overflow-hidden h-full"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <Brain className="w-32 h-32 text-cyan-400" />
                            </div>

                            <h3 className="text-sm font-bold font-mono text-cyan-500 tracking-[0.2em] mb-8 pb-4 border-b border-cyan-900/50 flex justify-between">
                                <span>PSYCHOLOGICAL_ANALYSIS</span>
                                <span className="opacity-50 font-normal">CLASSIFIED</span>
                            </h3>

                            {Object.keys(psychologicalProfile).length > 0 ? (
                                <div className="space-y-8 relative z-10">
                                    <div>
                                        <h4 className="text-xs text-cyan-700 font-mono tracking-widest uppercase mb-3 text-shadow">CORE TRAITS</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {(psychologicalProfile.core_traits || []).map((trait: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-black/50 border border-cyan-800 text-cyan-100 text-sm font-mono">
                                                    {trait.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-xs text-cyan-700 font-mono tracking-widest uppercase mb-3 text-shadow">COMMUNICATION STYLE</h4>
                                            <p className="font-mono text-sm text-cyan-100/80 leading-relaxed bg-black/30 p-4 border border-cyan-900">
                                                {psychologicalProfile.communication_style || "Unspecified"}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs text-cyan-700 font-mono tracking-widest uppercase mb-3 text-shadow">ATTACHMENT STYLE</h4>
                                            <p className="font-mono text-sm text-cyan-100/80 leading-relaxed bg-black/30 p-4 border border-cyan-900">
                                                {psychologicalProfile.attachment_style || "Unspecified"}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs text-cyan-700 font-mono tracking-widest uppercase mb-3 text-shadow">DEEP ANALYSIS</h4>
                                        <p className="text-base text-slate-300 leading-loose border-l border-cyan-500/50 pl-6 my-4 italic">
                                            "{psychologicalProfile.deep_analysis}"
                                        </p>
                                    </div>

                                    {profileData?.interests && profileData.interests.length > 0 && (
                                        <div className="pt-4 border-t border-cyan-900/30">
                                            <h4 className="text-xs text-cyan-700 font-mono tracking-widest uppercase mb-3 text-shadow">EXTRACTED INTERESTS</h4>
                                            <div className="flex flex-wrap gap-2 opacity-70">
                                                {profileData.interests.map((interest: string, idx: number) => (
                                                    <span key={idx} className="text-xs font-mono text-slate-400">
                                                        [{interest.toUpperCase()}]
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-20 font-mono text-slate-500 border border-dashed border-slate-800">
                                    <p className="mb-4">NEURAL PROFILE INCOMPLETE</p>
                                    <Link href="/onboarding" className="text-cyan-500 hover:text-cyan-400 underline decoration-cyan-900 text-sm">
                                        INITIATE ONBOARDING SEQUENCE to generate psychological model.
                                    </Link>
                                </div>
                            )}
                        </motion.div>

                        {/* Network Connections (Friends) */}
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-black/40 border border-slate-800 p-8 shadow-2xl relative"
                        >
                            <h3 className="text-sm font-bold font-mono text-slate-400 tracking-[0.2em] mb-6 pb-4 border-b border-slate-800 flex justify-between">
                                <span>VERIFIED NETWORK LINKS</span>
                                <span className="opacity-50 font-normal">[{friends.length}]</span>
                            </h3>

                            {friends.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friends.map((friend) => {
                                        const isOffline = !friend.is_online;
                                        const isRinging = ringingUsername === friend.username;

                                        return (
                                            <div key={friend.id} className="bg-white/5 border border-white/10 p-4 flex flex-col justify-between group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h4 className="text-white font-black uppercase text-lg">{friend.username}</h4>
                                                        <span className={`text-[10px] font-mono uppercase mt-1 block ${friend.is_online ? 'text-green-400' : 'text-slate-500'}`}>
                                                            {friend.is_online ? '● Online' : '○ Offline'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                                    {[
                                                        { icon: Phone, mode: 'voice', label: 'Voice' },
                                                        { icon: Video, mode: 'video', label: 'Video' }
                                                    ].map((btn) => (
                                                        <button
                                                            key={btn.mode}
                                                            disabled={isOffline || isRinging}
                                                            onClick={() => {
                                                                const initiateCall = async () => {
                                                                    try {
                                                                        setRingingUsername(friend.username);
                                                                        const res = await fetchApi('/matchmaking/join/', {
                                                                            method: 'POST',
                                                                            body: JSON.stringify({
                                                                                intent: `DIRECT_CONNECT:${friend.username}:${btn.mode}`,
                                                                                username: getUsername()
                                                                            })
                                                                        });
                                                                        if (res.room_name) {
                                                                            sendSignal('initiate_call', {
                                                                                target_user_id: friend.id,
                                                                                room_id: res.room_name,
                                                                                mode: btn.mode
                                                                            });
                                                                        }
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                        setRingingUsername(null);
                                                                    }
                                                                };
                                                                initiateCall();
                                                            }}
                                                            className={`flex flex-col items-center justify-center py-2 bg-black/40 border border-slate-700 transition-all ${isOffline
                                                                    ? 'opacity-30 cursor-not-allowed'
                                                                    : isRinging
                                                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400 animate-pulse'
                                                                        : 'hover:bg-cyan-500 hover:text-black hover:border-cyan-400 text-slate-400 group-hover:text-white'
                                                                }`}
                                                            title={isOffline ? 'Node offline' : btn.label}
                                                        >
                                                            <btn.icon className={`w-4 h-4 mb-1 ${isRinging ? 'opacity-100' : 'opacity-60'}`} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">
                                                                {isRinging ? 'Ringing...' : btn.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 font-mono text-slate-600 border border-dashed border-slate-800 text-sm">
                                    No direct links established yet.
                                </div>
                            )}
                        </motion.div>
                    </div>

                </div>
            </div>
        </div>
    );
}
// Using lucide-react Brain since it wasn't imported at top
function Brain({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M19.967 17.484A4 4 0 0 1 18 18" />
        </svg>
    )
}
