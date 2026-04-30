"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi, getMediaUrl } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, MapPin, Globe, Brain, Sparkles, ShieldCheck, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const username = params.username as string;

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isOwnProfile, setIsOwnProfile] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const data = await fetchApi(`/users/profile/${encodeURIComponent(username)}/`);
                setProfile(data);

                // Check if viewing own profile
                try {
                    const u = JSON.parse(localStorage.getItem('user') || '{}');
                    if (u?.username === username) setIsOwnProfile(true);
                } catch {}
            } catch (err: any) {
                setError(err.message || 'Profile not found');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [username]);

    const getAvatar = () => {
        if (!profile) return '';
        const img = profile.fast_avatar || profile.image;
        if (img && !img.includes('default.jpg')) return getMediaUrl(img);
        return `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(username)}&size=200`;
    };

    const trustColor = (tier: string) => {
        switch (tier) {
            case 'trusted': return 'text-emerald-500 bg-emerald-50 border-emerald-200';
            case 'established': return 'text-sky-500 bg-sky-50 border-sky-200';
            case 'flagged': return 'text-rose-500 bg-rose-50 border-rose-200';
            default: return 'text-slate-500 bg-slate-50 border-slate-200';
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0]">
            <div className="w-10 h-10 border-2 border-t-slate-800 border-slate-200 rounded-full animate-spin" />
        </div>
    );

    if (error || !profile) return (
        <div className="flex flex-col h-screen items-center justify-center bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] p-6 text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Profile Not Found</h1>
            <p className="text-slate-500 mb-6">{error || 'This user does not exist.'}</p>
            <button onClick={() => router.back()} className="px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold">Go Back</button>
        </div>
    );

    if (profile.message === 'This profile is private.') return (
        <div className="flex flex-col h-screen items-center justify-center bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] p-6 text-center">
            <ShieldCheck className="w-16 h-16 text-slate-400 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Private Profile</h1>
            <p className="text-slate-500 mb-6">This user has set their profile to private.</p>
            <button onClick={() => router.back()} className="px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold">Go Back</button>
        </div>
    );

    const interests = profile.interests || [];
    const expertise = profile.expertise_areas || [];
    const psych = profile.psychological_profile || {};

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] text-slate-900 font-sans">
            {/* Ambient */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
                <div className="absolute top-[5%] right-[5%] w-[500px] h-[500px] bg-white/50 blur-[100px] rounded-full mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6 pb-20">
                {/* Back Button */}
                <button onClick={() => router.back()} className="mb-6 p-2 bg-white/80 border border-slate-200/60 rounded-full shadow-sm hover:bg-white transition-all">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>

                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 backdrop-blur-2xl border border-white rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative p-8 pb-6 flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg mb-4">
                            <img src={getAvatar()} alt={username} className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{profile.user?.username || username}</h1>
                        
                        {/* Trust Badge */}
                        <div className={`mt-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${trustColor(profile.trust_tier)}`}>
                            {profile.trust_tier || 'New'} · {profile.trust_score ?? 100}/100
                        </div>

                        {/* Online + Location */}
                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                            {profile.is_online && (
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Online
                                </span>
                            )}
                            {profile.country && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {profile.country}{profile.state ? `, ${profile.state}` : ''}
                                </span>
                            )}
                        </div>

                        {/* Bio */}
                        {profile.bio && (
                            <p className="mt-4 text-sm text-slate-600 text-center leading-relaxed max-w-md">{profile.bio}</p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            {!isOwnProfile && (
                                <Link
                                    href={`/messages/${encodeURIComponent(username)}`}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                                >
                                    <MessageSquare className="w-4 h-4" /> Message
                                </Link>
                            )}
                            {isOwnProfile && (
                                <Link
                                    href="/profile"
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-colors"
                                >
                                    Edit Profile
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="border-t border-slate-100 px-8 py-6 space-y-6">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 bg-slate-50/50 rounded-2xl">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Age</p>
                                <p className="text-lg font-black text-slate-800">{profile.age || '—'}</p>
                            </div>
                            <div className="text-center p-3 bg-slate-50/50 rounded-2xl">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Gender</p>
                                <p className="text-lg font-black text-slate-800">{profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : 'Other'}</p>
                            </div>
                            <div className="text-center p-3 bg-slate-50/50 rounded-2xl">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Languages</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{(profile.languages || []).join(', ') || '—'}</p>
                            </div>
                        </div>

                        {/* Interests */}
                        {interests.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Interests
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {interests.map((item: string) => (
                                        <span key={item} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-tight text-slate-700">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Expertise */}
                        {expertise.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                    <Brain className="w-3.5 h-3.5 text-violet-400" /> Expertise
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {expertise.map((item: string) => (
                                        <span key={item} className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-xl text-[11px] font-bold uppercase tracking-tight text-violet-700">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Psychological Profile */}
                        {profile.show_ai_analysis && Object.keys(psych).length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                    <Globe className="w-3.5 h-3.5 text-sky-400" /> AI Psychological Insights
                                </h3>
                                <div className="space-y-2">
                                    {Object.entries(psych).slice(0, 6).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">{key.replace(/_/g, ' ')}</span>
                                            <span className="text-xs text-slate-700 leading-relaxed">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
