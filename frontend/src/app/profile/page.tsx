"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, User, Activity, Edit3, Phone, Video, AlertTriangle } from 'lucide-react';
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
    const [editCountry, setEditCountry] = useState('');
    const [editLanguages, setEditLanguages] = useState<string[]>([]);
    const [editLatitude, setEditLatitude] = useState<number | null>(null);
    const [editLongitude, setEditLongitude] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState<'persona' | 'real'>('persona');

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
            alert("The user declined your connection request.");
        };

        window.addEventListener('sys_call_answered', handleCallAccepted);
        window.addEventListener('sys_call_declined', handleCallDeclined);

        return () => {
            window.removeEventListener('sys_call_answered', handleCallAccepted);
            window.removeEventListener('sys_call_declined', handleCallDeclined);
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
            window.location.href = '/login';
            return;
        }
        try {
            const data = await fetchApi(`/users/profile/${storedUsername}/`);
            setProfileData(data);
            setEditBio(data.bio || '');
            setEditGender(data.gender || 'O');
            setEditAge(data.age || '18');
            setEditCountry(data.country || '');
            setEditLanguages(data.languages || []);
            setEditLatitude(data.latitude || null);
            setEditLongitude(data.longitude || null);
        } catch (err) {
            console.error("Failed to load profile", err);
            setError('Could not load your AI profile insights.');
        } finally {
            setLoading(false);
        }
    };

    const loadFriends = async () => {
        const storedUsername = getUsername();
        if (!storedUsername) return;
        try {
            const data = await fetchApi(`/matchmaking/friends/?username=${encodeURIComponent(storedUsername)}`);
            if (data.friends) {
                setFriends(data.friends);
            }
        } catch (err) {
            console.error("Failed to load friends", err);
        }
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const data = await fetchApi('/users/profile/upload-photo/', {
                method: 'POST',
                body: formData,
            });
            setProfileData((prev: any) => ({ ...prev, image: data.image_url }));
            alert('Authentic photo synchronized successfully.');
            setViewMode('real');
        } catch (err: any) {
            console.error("Failed to upload photo", err);
            alert(err.message || 'Failed to update profile visual.');
        } finally {
            setUploading(false);
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
                    country: editCountry,
                    languages: editLanguages,
                    latitude: editLatitude,
                    longitude: editLongitude
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

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setEditLatitude(position.coords.latitude);
                setEditLongitude(position.coords.longitude);
                alert("Neural coordinates synchronized.");
            },
            () => {
                alert("Unable to retrieve your location. Please check your browser permissions.");
            }
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050511] flex items-center justify-center text-white flex-col gap-6 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
                
                <div className="relative">
                    <div className="w-12 h-12 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-12 h-12 border-2 border-white/5 rounded-full"></div>
                </div>
                <p className="text-sm font-bold tracking-[0.2em] text-slate-400 uppercase animate-pulse">Synchronizing Profile Insights</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#050511] flex flex-col items-center justify-center text-white p-8 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
                
                <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl max-w-md w-full text-center shadow-2xl relative z-10">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black mb-2">Access Denied</h2>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">{error}</p>
                    <Link href="/dashboard" className="block w-full py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const psychologicalProfile = profileData?.psychological_profile || {};

    return (
        <div className="min-h-screen bg-transparent text-white selection:bg-cyan-500/30 font-sans p-6 md:p-12 relative overflow-hidden pb-32">

            <div className="max-w-6xl mx-auto relative z-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors font-bold text-xs uppercase px-5 py-2.5 border border-slate-800 rounded-xl bg-black/40 backdrop-blur-md shadow-lg">
                        <ArrowLeft className="w-4 h-4" /> Hub
                    </Link>
                    <h1 className="text-sm font-bold tracking-widest text-slate-500 uppercase border-b border-cyan-900/30 pb-2">
                        Advanced Profile
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Avatar & Basic Info */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-black/40 backdrop-blur-2xl border border-white/5 p-8 rounded-3xl shadow-2xl relative overflow-hidden group"
                        >
                            {/* The Persona Image */}
                            <div className="aspect-square w-full bg-slate-900/50 border border-white/10 rounded-2xl mb-6 relative overflow-hidden flex items-center justify-center shadow-inner">
                                {viewMode === 'persona' ? (
                                    profileData?.persona_image_url ? (
                                        <img
                                            src={profileData.persona_image_url}
                                            alt="AI Persona"
                                            className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-700 scale-105 group-hover:scale-100"
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-xs text-center p-6 flex flex-col items-center gap-3">
                                            <User className="w-12 h-12 opacity-10" />
                                            <p className="font-medium">Profile visual pending.<br /><span className="text-[10px] opacity-70">Complete onboarding to generate.</span></p>
                                        </div>
                                    )
                                ) : (
                                    profileData?.image ? (
                                        <img
                                            src={`http://127.0.0.1:8000${profileData.image}`}
                                            alt="Real Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-xs text-center p-6 flex flex-col items-center gap-3">
                                            <User className="w-12 h-12 opacity-10" />
                                            <p className="font-medium">No photo uploaded.</p>
                                        </div>
                                    )
                                )}

                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold text-cyan-400 z-10 shadow-lg">
                                    <Activity className="w-3 h-3 text-cyan-400" /> Trust Score: {profileData?.trust_score || 100}
                                </div>

                                <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button
                                        onClick={() => setViewMode(viewMode === 'persona' ? 'real' : 'persona')}
                                        className="flex-1 text-[10px] font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-2.5 rounded-xl border border-white/10 backdrop-blur-md transition-all"
                                    >
                                        {viewMode === 'persona' ? 'View Real Photo' : 'View AI Persona'}
                                    </button>
                                    <label className="flex-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2.5 rounded-xl border border-cyan-500/20 backdrop-blur-md transition-all cursor-pointer text-center">
                                        {uploading ? 'Processing...' : 'Upload Photo'}
                                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                                    </label>
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Biography</label>
                                        <textarea
                                            value={editBio}
                                            onChange={(e) => setEditBio(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-cyan-500/50 focus:bg-white/10 outline-none p-4 text-sm leading-relaxed transition-all h-32"
                                            placeholder="Introduce yourself to the network..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Gender</label>
                                            <select
                                                value={editGender}
                                                onChange={(e) => setEditGender(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-cyan-500/50 focus:bg-white/10 outline-none p-4 text-sm appearance-none cursor-pointer transition-all"
                                            >
                                                <option value="M">Male</option>
                                                <option value="F">Female</option>
                                                <option value="O">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Age</label>
                                            <input
                                                type="number"
                                                value={editAge}
                                                onChange={(e) => setEditAge(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-cyan-500/50 focus:bg-white/10 outline-none p-4 text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Country & Region</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={editCountry}
                                                onChange={(e) => setEditCountry(e.target.value)}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-2xl focus:border-cyan-500/50 focus:bg-white/10 outline-none p-4 text-sm appearance-none cursor-pointer transition-all"
                                            >
                                                <option value="">Select Country</option>
                                                <option value="IN">India</option>
                                                <option value="US">United States</option>
                                                <option value="GB">United Kingdom</option>
                                                <option value="CA">Canada</option>
                                                <option value="AU">Australia</option>
                                                {/* Add more as needed */}
                                            </select>
                                            <button 
                                                onClick={handleGetLocation}
                                                className={`px-4 bg-white/5 border ${editLatitude ? 'border-green-500/50 text-green-400' : 'border-white/10 text-slate-400'} rounded-2xl hover:bg-white/10 transition-all font-mono text-[10px] uppercase`}
                                            >
                                                {editLatitude ? '✓ Fixed' : '📍 Sync GPS'}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Languages (comma separated)</label>
                                        <input
                                            type="text"
                                            value={editLanguages.join(', ')}
                                            onChange={(e) => setEditLanguages(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                            placeholder="en, hi, es..."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-cyan-500/50 focus:bg-white/10 outline-none p-4 text-sm transition-all font-mono"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-3.5 rounded-2xl border border-white/10 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{profileData?.user?.username}</h2>
                                            <div className="text-xs font-bold text-slate-500 flex flex-wrap gap-2 items-center">
                                                <span>{profileData?.gender === 'M' ? 'Male' : profileData?.gender === 'F' ? 'Female' : 'Other'}</span>
                                                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                                <span>{profileData?.age} Years Old</span>
                                                {profileData?.country && (
                                                    <>
                                                        <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                                        <span className="text-cyan-400/80">{profileData.country}</span>
                                                    </>
                                                )}
                                            </div>
                                            {profileData?.languages?.length > 0 && (
                                                <div className="flex gap-1.5 mt-3">
                                                    {profileData.languages.map((l: string) => (
                                                        <span key={l} className="text-[9px] font-mono border border-white/10 bg-white/5 px-2 py-0.5 rounded text-slate-400 uppercase tracking-widest">{l}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="text-[15px] text-slate-300 leading-relaxed mt-8 border-l-3 border-cyan-500/30 pl-6 py-1 italic font-medium">
                                        {profileData?.bio || <span className="text-slate-600">Complete your bio to stand out.</span>}
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
                            className="bg-indigo-500/5 backdrop-blur-3xl border border-indigo-500/10 p-10 rounded-3xl shadow-2xl relative overflow-hidden h-full"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                <Brain className="w-48 h-48 text-indigo-400" />
                            </div>

                            <h3 className="text-xs font-bold text-indigo-400 tracking-[0.2em] mb-10 pb-4 border-b border-indigo-500/10 flex justify-between items-center uppercase">
                                <span>Psychological Profile</span>
                                <span className="text-[9px] opacity-40 font-medium px-2 py-0.5 border border-indigo-500/20 rounded-full">AI Insights</span>
                            </h3>

                            {Object.keys(psychologicalProfile).length > 0 ? (
                                <div className="space-y-8 relative z-10">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest mb-4">Core Traits</h4>
                                        <div className="flex flex-wrap gap-2.5">
                                            {(psychologicalProfile.core_traits || []).map((trait: string, idx: number) => (
                                                <span key={idx} className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[13px] font-medium rounded-xl shadow-sm">
                                                    {trait}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest mb-3">Communication Style</h4>
                                            <p className="text-[14px] text-slate-300 leading-relaxed bg-white/5 p-5 rounded-2xl border border-white/5">
                                                {psychologicalProfile.communication_style || "Unspecified"}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest mb-3">Attachment Style</h4>
                                            <p className="text-[14px] text-slate-300 leading-relaxed bg-white/5 p-5 rounded-2xl border border-white/5">
                                                {psychologicalProfile.attachment_style || "Unspecified"}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest mb-3">Deep Analysis</h4>
                                        <p className="text-lg text-slate-200 leading-loose border-l-4 border-indigo-500/40 pl-8 my-6 italic font-medium">
                                            "{psychologicalProfile.deep_analysis}"
                                        </p>
                                    </div>

                                    {profileData?.interests && profileData.interests.length > 0 && (
                                        <div className="pt-6 border-t border-white/5">
                                            <h4 className="text-[10px] font-bold text-indigo-300/60 uppercase tracking-widest mb-4">Extracted Interests</h4>
                                            <div className="flex flex-wrap gap-2 opacity-80">
                                                {profileData.interests.map((interest: string, idx: number) => (
                                                    <span key={idx} className="text-[11px] font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                                        #{interest}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-8 border-t border-white/5 mt-4">
                                        <Link
                                            href="/onboarding?retake=true"
                                            className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-black font-black text-[11px] tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/20 uppercase"
                                        >
                                            ↻ Recalibrate Analysis
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 text-slate-500 border border-dashed border-white/10 rounded-3xl backdrop-blur-sm">
                                    <p className="mb-6 font-bold uppercase tracking-widest text-[11px]">Personality Profile Incomplete</p>
                                    <Link href="/onboarding" className="inline-block px-8 py-3.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold rounded-2xl border border-cyan-500/20 transition-all text-sm">
                                        Initiate Onboarding Sequence
                                    </Link>
                                </div>
                            )}
                        </motion.div>

                        {/* Network Connections (Friends) */}
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="bg-black/40 backdrop-blur-2xl border border-white/5 p-10 rounded-3xl shadow-2xl relative"
                        >
                            <h3 className="text-xs font-bold text-slate-400 tracking-[0.2em] mb-10 pb-4 border-b border-white/5 flex justify-between items-center uppercase">
                                <span>Friends Network</span>
                                <span className="text-[10px] opacity-40 font-bold px-2 py-0.5 border border-white/10 rounded-lg">{friends.length} Connections</span>
                            </h3>

                            {friends.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {friends.map((friend) => {
                                        const isOffline = !friend.is_online;
                                        const isRinging = ringingUsername === friend.username;

                                        return (
                                            <div key={friend.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between group hover:bg-white/[0.08] transition-all duration-300 shadow-sm">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center font-black text-xl text-white">
                                                            {friend.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-white font-bold text-lg tracking-tight leading-none mb-1">{friend.username}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${friend.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${friend.is_online ? 'text-green-400' : 'text-slate-500'}`}>
                                                                    {friend.is_online ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 mt-auto">
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
                                                            className={`flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl transition-all ${isOffline
                                                                ? 'opacity-30 cursor-not-allowed grayscale'
                                                                : isRinging
                                                                    ? 'bg-cyan-500 text-black border-cyan-500 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                                                                    : 'hover:bg-cyan-500 hover:text-black hover:border-cyan-500 text-slate-300'
                                                                }`}
                                                            title={isOffline ? 'User offline' : btn.label}
                                                        >
                                                            <btn.icon className={`w-3.5 h-3.5 ${isRinging ? 'opacity-100' : 'opacity-60'}`} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                {isRinging ? 'Ringing' : btn.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-600 border border-dashed border-white/10 rounded-2xl text-sm font-medium">
                                    No connections established yet.
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
