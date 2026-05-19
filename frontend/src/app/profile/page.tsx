"use client";

import { useState, useEffect } from 'react';
import { fetchApi, getMediaUrl } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, User, Activity, Edit3, AlertTriangle, ShieldCheck, Upload, CheckCircle, X, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Editable fields
    const [editBio, setEditBio] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editAge, setEditAge] = useState('');
    const [editCountry, setEditCountry] = useState('');
    const [editLanguages, setEditLanguages] = useState<string[]>([]);
    const [editLatitude, setEditLatitude] = useState<number | null>(null);
    const [editLongitude, setEditLongitude] = useState<number | null>(null);
    const [editOfflineSearch, setEditOfflineSearch] = useState<boolean>(false);
    const [saving, setSaving] = useState(false);

    // Avatar state
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarTab, setAvatarTab] = useState<'upload' | 'preset'>('upload');
    const [uploadingImage, setUploadingImage] = useState(false);

    const PRESET_CATEGORIES = [
        {
            id: 'animals',
            label: '🐾 Animals',
            description: 'Spirit animal — reflects your true nature',
            // Robohash set4 = actual illustrated animal avatars
            avatars: [
                { url: 'https://robohash.org/Lion?set=set4&size=300x300',    label: 'Lion' },
                { url: 'https://robohash.org/Tiger?set=set4&size=300x300',   label: 'Tiger' },
                { url: 'https://robohash.org/Wolf?set=set4&size=300x300',    label: 'Wolf' },
                { url: 'https://robohash.org/Fox?set=set4&size=300x300',     label: 'Fox' },
                { url: 'https://robohash.org/Bear?set=set4&size=300x300',    label: 'Bear' },
                { url: 'https://robohash.org/Panda?set=set4&size=300x300',   label: 'Panda' },
                { url: 'https://robohash.org/Owl?set=set4&size=300x300',     label: 'Owl' },
                { url: 'https://robohash.org/Eagle?set=set4&size=300x300',   label: 'Eagle' },
                { url: 'https://robohash.org/Cat?set=set4&size=300x300',     label: 'Cat' },
                { url: 'https://robohash.org/Rabbit?set=set4&size=300x300',  label: 'Rabbit' },
                { url: 'https://robohash.org/Dolphin?set=set4&size=300x300', label: 'Dolphin' },
                { url: 'https://robohash.org/Penguin?set=set4&size=300x300', label: 'Penguin' },
            ]
        },
        {
            id: 'characters',
            label: '🧑 Characters',
            description: 'Illustrated persona — your social face',
            avatars: [
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Aurora&backgroundColor=fef9c3&size=300',    label: 'Aurora' },
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Blaze&backgroundColor=fce7f3&size=300',     label: 'Blaze' },
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Storm&backgroundColor=dbeafe&size=300',     label: 'Storm' },
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Nova&backgroundColor=dcfce7&size=300',      label: 'Nova' },
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Ember&backgroundColor=ffe4e6&size=300',     label: 'Ember' },
                { url: 'https://api.dicebear.com/7.x/lorelei/png?seed=Echo&backgroundColor=ede9fe&size=300',      label: 'Echo' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Raven&backgroundColor=1e1b4b&hairColor=f9a8d4&size=300',  label: 'Raven' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Kai&backgroundColor=0f172a&hairColor=7dd3fc&size=300',    label: 'Kai' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Zara&backgroundColor=064e3b&hairColor=fde68a&size=300',   label: 'Zara' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Orion&backgroundColor=1c1917&hairColor=a5f3fc&size=300',  label: 'Orion' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Sage&backgroundColor=312e81&hairColor=bbf7d0&size=300',   label: 'Sage' },
                { url: 'https://api.dicebear.com/7.x/micah/png?seed=Lyra&backgroundColor=4a1942&hairColor=fed7aa&size=300',   label: 'Lyra' },
            ]
        },
        {
            id: 'artistic',
            label: '🎨 Artistic',
            description: 'Abstract identity — for the creatives',
            avatars: [
                { url: 'https://api.dicebear.com/7.x/rings/png?seed=Cosmic&backgroundColor=0f0f23&size=300',       label: 'Cosmic' },
                { url: 'https://api.dicebear.com/7.x/rings/png?seed=Nebula&backgroundColor=1a0033&size=300',       label: 'Nebula' },
                { url: 'https://api.dicebear.com/7.x/rings/png?seed=Prism&backgroundColor=012a1a&size=300',        label: 'Prism' },
                { url: 'https://api.dicebear.com/7.x/rings/png?seed=Solstice&backgroundColor=1a0d00&size=300',     label: 'Solstice' },
                { url: 'https://api.dicebear.com/7.x/shapes/png?seed=Vortex&backgroundColor=0f172a&size=300',      label: 'Vortex' },
                { url: 'https://api.dicebear.com/7.x/shapes/png?seed=Flux&backgroundColor=1c0a2e&size=300',        label: 'Flux' },
                { url: 'https://api.dicebear.com/7.x/shapes/png?seed=Apex&backgroundColor=0c1a0c&size=300',        label: 'Apex' },
                { url: 'https://api.dicebear.com/7.x/shapes/png?seed=Drift&backgroundColor=1a0808&size=300',       label: 'Drift' },
                { url: 'https://api.dicebear.com/7.x/bottts/png?seed=Unit7&backgroundColor=0a0a0a&size=300',       label: 'Unit 7' },
                { url: 'https://api.dicebear.com/7.x/bottts/png?seed=Axiom&backgroundColor=050510&size=300',       label: 'Axiom' },
                { url: 'https://api.dicebear.com/7.x/bottts/png?seed=Nexus&backgroundColor=001a10&size=300',       label: 'Nexus' },
                { url: 'https://api.dicebear.com/7.x/bottts/png?seed=Zenith&backgroundColor=100010&size=300',      label: 'Zenith' },
            ]
        },
    ];
    const [presetCategory, setPresetCategory] = useState('animals');
    const activeCategory = PRESET_CATEGORIES.find(c => c.id === presetCategory) || PRESET_CATEGORIES[0];

    useEffect(() => {
        loadProfile();
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
            if (data.image) {
                // Legacy image handling removed
            }
            setEditBio(data.bio || '');
            setEditGender(data.gender || 'O');
            setEditAge(data.age || '18');
            setEditCountry(data.country || '');
            setEditLanguages(data.languages || []);
            setEditLatitude(data.latitude || null);
            setEditLongitude(data.longitude || null);
            setEditOfflineSearch(data.available_for_offline_search || false);
        } catch (err) {
            console.error("Failed to load profile", err);
            setError('Could not load your AI profile insights.');
        } finally {
            setLoading(false);
        }
    };


    const handleSave = async () => {
        const storedUsername = getUsername();
        if (!storedUsername) return;
        setSaving(true);
        try {
            const data = await fetchApi(`/users/profile/`, {
                method: 'PATCH',
                body: JSON.stringify({
                    bio: editBio,
                    gender: editGender,
                    age: parseInt(editAge) || 18,
                    country: editCountry,
                    languages: editLanguages,
                    latitude: editLatitude,
                    longitude: editLongitude,
                    available_for_offline_search: editOfflineSearch
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetchApi('/users/profile/image/', {
                method: 'POST',
                body: formData
            });
            if (res.image_url) {
                setProfileData({ ...profileData, image: res.image_url });
                setShowAvatarModal(false);
            }
        } catch (err: any) {
            alert(`Failed to upload image: ${err.message || 'Server error'}`);
            console.error(err);
        } finally {
            setUploadingImage(false);
        }
    };

    const handlePresetSelect = async (url: string) => {
        setUploadingImage(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const formData = new FormData();
            formData.append('image', blob, 'preset.png');
            const res = await fetchApi('/users/profile/image/', {
                method: 'POST',
                body: formData
            });
            if (res.image_url) {
                setProfileData({ ...profileData, image: res.image_url });
                setShowAvatarModal(false);
            }
        } catch (err: any) {
            alert(`Failed to set preset image: ${err.message || 'Server error'}`);
            console.error(err);
        } finally {
            setUploadingImage(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center text-slate-900 flex-col gap-6 relative overflow-hidden text-center">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
                
                <div className="relative">
                    <div className="w-12 h-12 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-12 h-12 border-2 border-slate-200 rounded-full"></div>
                </div>
                <p className="text-sm font-bold tracking-[0.2em] text-slate-400 uppercase animate-pulse">Synchronizing Profile Insights</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center text-slate-900 p-8 relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
                
                <div className="bg-white/80 border border-slate-200/60 shadow-sm p-8 rounded-3xl backdrop-blur-xl max-w-md w-full text-center shadow-2xl relative z-10">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black mb-2">Profile Error</h2>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">{error}</p>
                    <Link href="/dashboard" className="block w-full py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all shadow-sm">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const psychologicalProfile = profileData?.psychological_profile || {};
    const isDefaultImage = profileData?.image?.endsWith('default.jpg');
    const rawAvatarSrc = (!isDefaultImage && profileData?.image) ? profileData.image : profileData?.persona_image_url;
    const avatarSrc = getMediaUrl(rawAvatarSrc);

    return (
        <div className="min-h-screen bg-[#fafaf9] text-slate-900 selection:bg-cyan-500/30 font-sans p-6 md:p-12 relative overflow-hidden pb-32">

            <div className="max-w-6xl mx-auto relative z-20">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-xs uppercase px-5 py-2.5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                        <ArrowLeft className="w-4 h-4" /> Dashboard
                    </Link>
                    <h1 className="text-sm font-bold tracking-widest text-slate-400 uppercase border-b border-slate-200 pb-2">
                        Neural Identity Profile
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Avatar & Basic Info */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="bg-white/80 backdrop-blur-2xl border border-slate-200/60 p-6 md:p-8 rounded-[24px] md:rounded-[32px] shadow-xl relative overflow-hidden group"
                        >
                            {/* The Persona Image */}
                            <div className="aspect-square w-full bg-slate-100 border border-slate-200 rounded-[24px] mb-6 relative overflow-hidden flex items-center justify-center shadow-inner group/avatar">
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt="User Avatar"
                                        className="w-full h-full object-cover mix-blend-luminosity group-hover/avatar:mix-blend-normal transition-all duration-700 scale-105 group-hover/avatar:scale-100"
                                    />
                                ) : (
                                    <div className="text-slate-500 text-xs text-center p-6 flex flex-col items-center gap-3">
                                        <User className="w-12 h-12 opacity-10" />
                                        <p className="font-medium">Profile visual pending.<br /><span className="text-[10px] opacity-70">Complete onboarding to generate.</span></p>
                                    </div>
                                )}
                                
                                {/* Edit Avatar Overlay */}
                                <button
                                    onClick={() => setShowAvatarModal(true)}
                                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover/avatar:opacity-100 transition-all flex items-center justify-center flex-col gap-2 z-20"
                                >
                                    <Camera className="w-8 h-8 text-white" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-white">Edit Photo</span>
                                </button>

                                <div className={`absolute top-3 right-3 backdrop-blur-md border shadow-sm px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold z-10 ${
                                    profileData?.trust_tier === 'A' ? 'bg-green-50/90 text-green-700 border-green-200' :
                                    profileData?.trust_tier === 'B' ? 'bg-amber-50/90 text-amber-700 border-amber-200' :
                                    profileData?.trust_tier === 'C' ? 'bg-orange-50/90 text-orange-700 border-orange-200' :
                                    profileData?.trust_tier === 'D' ? 'bg-red-50/90 text-red-700 border-red-200' :
                                    'bg-white/80 text-slate-600 border-slate-200'
                                }`}>
                                    {profileData?.trust_tier === 'A' ? <ShieldCheck className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                                    <span>Trust: {profileData?.trust_score ?? 100} — Tier {profileData?.trust_tier || 'A'}</span>
                                </div>

                            </div>

                            {isEditing ? (
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Biography</label>
                                        <textarea
                                            value={editBio}
                                            onChange={(e) => setEditBio(e.target.value)}
                                            className="w-full bg-white/80 border border-slate-200/60 shadow-sm rounded-2xl focus:border-slate-200 focus:bg-white/10 outline-none p-4 text-sm leading-relaxed transition-all h-32"
                                            placeholder="Introduce yourself to the network..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Gender</label>
                                            <select
                                                value={editGender}
                                                onChange={(e) => setEditGender(e.target.value)}
                                                className="w-full bg-white/80 border border-slate-200/60 shadow-sm rounded-2xl focus:border-slate-200 focus:bg-white/10 outline-none p-4 text-sm appearance-none cursor-pointer transition-all"
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
                                                className="w-full bg-white/80 border border-slate-200/60 shadow-sm rounded-2xl focus:border-slate-200 focus:bg-white/10 outline-none p-4 text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Country & Region</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={editCountry}
                                                onChange={(e) => setEditCountry(e.target.value)}
                                                className="flex-1 bg-white/80 border border-slate-200/60 shadow-sm rounded-2xl focus:border-slate-200 focus:bg-white/10 outline-none p-4 text-sm appearance-none cursor-pointer transition-all"
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
                                                className={`px-4 bg-white/80 border ${editLatitude ? 'border-slate-200 text-green-400' : 'border-slate-200/60 shadow-sm text-slate-400'} rounded-2xl hover:bg-white/10 transition-all font-sans text-[13px] font-medium text-[10px] uppercase`}
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
                                            className="w-full bg-white/80 border border-slate-200/60 shadow-sm rounded-2xl focus:border-slate-200 focus:bg-white/10 outline-none p-4 text-sm transition-all font-sans text-[13px] font-medium"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={editOfflineSearch}
                                                    onChange={(e) => setEditOfflineSearch(e.target.checked)}
                                                />
                                                <div className={`block w-10 h-6 rounded-full transition-colors ${editOfflineSearch ? 'bg-cyan-500' : 'bg-slate-300'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${editOfflineSearch ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                            <div>
                                                <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-widest">Available for Offline Search</span>
                                                <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">Opt-in to be discovered by others when you're offline.<br/>Automatically turns off daily at 12 PM GMT for privacy.</span>
                                            </div>
                                        </label>
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
                                            className="px-6 bg-white/80 hover:bg-white/10 text-white font-bold text-xs py-3.5 rounded-2xl border border-slate-200/60 shadow-sm transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">{profileData?.user?.username}</h2>
                                            <div className="text-xs font-bold text-slate-400 flex flex-wrap gap-2 items-center">
                                                <span>{profileData?.gender === 'M' ? 'Male' : profileData?.gender === 'F' ? 'Female' : 'Other'}</span>
                                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                <span>{profileData?.age} Years Old</span>
                                                {profileData?.country && (
                                                    <>
                                                        <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                        <span className="text-slate-400/80">{profileData.country}</span>
                                                    </>
                                                )}
                                            </div>
                                            {profileData?.languages?.length > 0 && (
                                                <div className="flex gap-1.5 mt-3">
                                                    {profileData.languages.map((l: string) => (
                                                        <span key={l} className="text-[9px] font-sans text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg uppercase tracking-widest">{l}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 hover:border-slate-900 transition-all shadow-sm"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>Edit Profile</span>
                                        </button>
                                    </div>

                                    <div className="text-[15px] text-slate-600 leading-relaxed mt-8 border-l-4 border-cyan-500/20 pl-6 py-2 italic font-medium">
                                        {profileData?.bio || <span className="text-slate-400 font-normal">Complete your bio to stand out.</span>}
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
                            className="bg-white/90 backdrop-blur-2xl border border-slate-200/60 p-6 md:p-10 rounded-[24px] md:rounded-[32px] shadow-xl relative overflow-hidden h-full"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <Brain className="w-48 h-48 text-indigo-900" />
                            </div>

                            <h3 className="text-xs font-bold text-slate-400 tracking-[0.2em] mb-10 pb-4 border-b border-slate-100 flex justify-between items-center uppercase">
                                <span>Psychological Profile</span>
                                <span className="text-[9px] text-slate-500 font-bold px-2.5 py-1 border border-slate-200 rounded-full bg-slate-50 shadow-sm">AI Insights</span>
                            </h3>

                            {Object.keys(psychologicalProfile).length > 0 ? (
                                <div className="space-y-10 relative z-10">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 px-1">Core Neural Traits</h4>
                                        <div className="flex flex-wrap gap-3">
                                            {(psychologicalProfile.core_traits || []).map((trait: string, idx: number) => (
                                                <span key={idx} className="px-5 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl shadow-sm">
                                                    {trait}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Communication</h4>
                                            <p className="text-[14px] text-slate-600 leading-relaxed italic font-medium">
                                                {psychologicalProfile.communication_style || "Accessing..."}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Attachment</h4>
                                            <p className="text-[14px] text-slate-600 leading-relaxed italic font-medium">
                                                {psychologicalProfile.attachment_style || "Determining..."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute -left-10 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/0 via-indigo-500/20 to-indigo-500/0" />
                                        <p className="text-lg text-slate-800 leading-loose italic font-medium pl-2">
                                            "{psychologicalProfile.deep_analysis}"
                                        </p>
                                    </div>

                                    {profileData?.interests && profileData.interests.length > 0 && (
                                        <div className="pt-8 border-t border-slate-100">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Data Tags</h4>
                                            <div className="flex flex-wrap gap-2.5">
                                                {profileData.interests.map((interest: string, idx: number) => (
                                                    <span key={idx} className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-xl border border-cyan-100 uppercase tracking-tighter">
                                                        #{interest}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-8 border-t border-slate-100 mt-4 text-center md:text-left">
                                        <Link
                                            href="/onboarding?retake=true"
                                            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] tracking-widest rounded-2xl transition-all shadow-xl hover:-translate-y-0.5 uppercase"
                                        >
                                            ↻ Recalibrate Analysis
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 text-slate-400 border border-dashed border-slate-200 rounded-[32px] bg-slate-50/50">
                                    <p className="mb-6 font-bold uppercase tracking-widest text-[11px]">Personality Profile Incomplete</p>
                                    <Link href="/onboarding" className="inline-block px-10 py-4 bg-white text-slate-600 font-black tracking-widest rounded-2xl border border-slate-200 shadow-lg hover:bg-slate-50 transition-all text-[11px] uppercase">
                                        Initiate Onboarding
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    </div>

                </div>
            </div>

            {/* Avatar Update Modal */}
            <AnimatePresence>
                {showAvatarModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative"
                        >
                            <button onClick={() => setShowAvatarModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-slate-100 transition-all">
                                <X className="w-5 h-5"/>
                            </button>
                            <h3 className="text-xl font-black mb-6 text-slate-900">Update Profile Photo</h3>
                            
                            <div className="flex gap-4 mb-8">
                                <button 
                                    onClick={() => setAvatarTab('upload')} 
                                    className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${avatarTab === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                    Upload Local
                                </button>
                                <button 
                                    onClick={() => setAvatarTab('preset')} 
                                    className={`flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${avatarTab === 'preset' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                    Use Preset
                                </button>
                            </div>

                            {avatarTab === 'upload' ? (
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[24px] p-8 text-center bg-slate-50 relative group cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/50 transition-all">
                                    {uploadingImage ? (
                                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-slate-400 group-hover:text-cyan-500 mb-4 transition-colors" />
                                            <p className="text-sm font-bold text-slate-600 mb-1">Click to browse</p>
                                            <p className="text-xs text-slate-400">PNG, JPG up to 5MB</p>
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        accept="image/png, image/jpeg, image/webp" 
                                        onChange={handleImageUpload} 
                                        disabled={uploadingImage} 
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                                        title="Choose a profile picture"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Category Tabs */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {PRESET_CATEGORIES.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setPresetCategory(cat.id)}
                                                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                                    presetCategory === cat.id
                                                        ? 'bg-slate-900 text-white shadow-md'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-medium">{activeCategory.description}</p>

                                    {/* Preset Grid */}
                                    <div className="grid grid-cols-4 gap-2.5 relative">
                                        {activeCategory.avatars.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handlePresetSelect(preset.url)}
                                                disabled={uploadingImage}
                                                title={preset.label}
                                                className="aspect-square rounded-2xl bg-slate-100 overflow-hidden relative group hover:ring-4 hover:ring-cyan-500 transition-all"
                                            >
                                                <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-900/60 transition-opacity gap-1">
                                                    <CheckCircle className="w-5 h-5 text-white" />
                                                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">{preset.label}</span>
                                                </div>
                                            </button>
                                        ))}
                                        {uploadingImage && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 rounded-2xl">
                                                <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
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
