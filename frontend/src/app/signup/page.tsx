"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Network,
    AtSign,
    Fingerprint,
    Dna,
    Hourglass,
    Terminal,
    AlertTriangle,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import Logo from '@/components/Logo';

export default function SignUp() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState('O');
    const [age, setAge] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const existingUser = localStorage.getItem('user');
        if (existingUser) {
            router.replace('/dashboard');
        }
    }, [router]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            const data = await fetch('http://127.0.0.1:8000/api/users/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: name,
                    email: email,
                    password: password,
                    gender: gender,
                    age: age ? parseInt(age) : 18
                })
            }).then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.error || 'Registration failed.');
                return json;
            });

            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            router.push('/onboarding');
        } catch (error: any) {
            setErrorMsg(error?.message || "Connection error. Please try again later.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020205] text-cyan-50 p-4">
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 bg-[url('/glysmork_signup.png')] bg-cover bg-center opacity-20 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-[#020205] z-0" />
            <div className="absolute inset-0 bg-noise z-10" />

            {/* Floating Orbs */}
            <motion.div
                animate={{ x: [-20, 20, -20], y: [-20, 30, -20], scale: [1, 1.3, 1] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/4 -left-1/4 w-[50vw] h-[50vw] min-w-[400px] min-h-[400px] bg-emerald-600/10 blur-[120px] rounded-full z-0"
            />
            <motion.div
                animate={{ x: [20, -20, 20], y: [20, -30, 20], scale: [1, 1.2, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] min-w-[500px] min-h-[500px] bg-cyan-900/20 blur-[150px] rounded-full z-0"
            />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-2xl p-6 sm:p-10 relative z-20 ultra-glass rounded-3xl"
            >
                {/* Branding & Header */}
                <div className="flex flex-col items-center mb-8 relative">
                    <button
                        type="button"
                        onClick={() => router.push('/login')}
                        className="absolute left-0 top-0 text-cyan-600 hover:text-cyan-400 transition-colors p-2"
                        title="Return to Login"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="scale-100 mb-2 opacity-90 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <Logo />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-500/80 font-mono mt-2">
                        Create Your Account
                    </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-6">
                    {/* Error Display */}
                    {errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-950/40 border border-red-500/50 rounded-lg p-4 flex items-start gap-3 text-red-300 font-mono text-xs shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        >
                            <Terminal className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <span>{errorMsg}</span>
                        </motion.div>
                    )}

                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Username Input */}
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-mono tracking-[0.2em] text-emerald-500 uppercase flex items-center justify-between">
                                <span>Username</span>
                                <Network className="w-3 h-3 opacity-50" />
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-emerald-50 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:bg-emerald-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                                    placeholder="Enter Handle"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-mono tracking-[0.2em] text-emerald-500 uppercase flex items-center justify-between">
                                <span>Email Address</span>
                                <AtSign className="w-3 h-3 opacity-50" />
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-emerald-50 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:bg-emerald-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-mono tracking-[0.2em] text-purple-500 uppercase flex items-center justify-between">
                                <span>Password</span>
                                <Fingerprint className="w-3 h-3 opacity-50" />
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono tracking-widest text-emerald-50 placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:bg-purple-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                                    placeholder="••••••••••••"
                                    required
                                />
                            </div>
                            <p className="text-[9px] font-mono text-slate-500 text-right opacity-70">Min 8 chars, mixed type.</p>
                        </div>

                        {/* Demographics Row */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Gender */}
                            <div className="space-y-2 group">
                                <label className="text-[10px] font-mono tracking-[0.2em] text-cyan-500 uppercase flex items-center justify-between">
                                    <span>Gender</span>
                                    <Dna className="w-3 h-3 opacity-50" />
                                </label>
                                <div className="relative">
                                    <select
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-cyan-50 focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)] appearance-none cursor-pointer"
                                    >
                                        <option value="M" className="bg-[#0f172a] text-cyan-400">MALE</option>
                                        <option value="F" className="bg-[#0f172a] text-cyan-400">FEMALE</option>
                                        <option value="O" className="bg-[#0f172a] text-cyan-400">OTHER</option>
                                    </select>
                                </div>
                            </div>

                            {/* Age */}
                            <div className="space-y-2 group">
                                <label className="text-[10px] font-mono tracking-[0.2em] text-cyan-500 uppercase flex items-center justify-between">
                                    <span>Age</span>
                                    <Hourglass className="w-3 h-3 opacity-50" />
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="18"
                                        max="100"
                                        value={age}
                                        onChange={(e) => setAge(e.target.value)}
                                        className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                        placeholder="18"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compliance Checkbox */}
                    <div className="relative mt-8 p-1 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/20 to-red-500/0">
                        <div className="bg-black/60 rounded-lg p-5 border border-red-500/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                            <div className="flex items-start gap-4">
                                <div className="relative pt-1 flex-[0]">
                                    <input
                                        type="checkbox"
                                        required
                                        className="peer w-5 h-5 appearance-none rounded border-2 border-slate-600 bg-black/50 checked:bg-red-600 checked:border-red-500 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[20%] opacity-0 peer-checked:opacity-100 text-white font-bold text-xs mt-[1px]">✓</div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                        <span className="text-[10px] font-mono font-bold text-red-400 tracking-widest uppercase">Community Guidelines</span>
                                    </div>
                                    <p className="text-xs font-sans text-slate-300 leading-relaxed text-justify pr-2">
                                        I agree to use this platform for friendly connections only. I will not broadcast explicit or sexual content. I understand that violating these rules will result in an immediate account ban.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`relative w-full overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/40 via-cyan-900/40 to-emerald-900/40 py-4 font-mono text-sm tracking-widest text-emerald-100 uppercase transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black ${isSubmitting ? 'opacity-70 scale-95 hover:scale-95' : ''}`}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isSubmitting ? 'INITIALIZING...' : (
                                    <>
                                        Get Started
                                        <ChevronRight className="w-4 h-4 animate-pulse" />
                                    </>
                                )}
                            </span>
                            {/* Hover Sweep Effect */}
                            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent hover:animate-[sweep_1.5s_ease-in-out_infinite]" />
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
