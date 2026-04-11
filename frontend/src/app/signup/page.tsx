"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
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

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

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
            const data = await fetchApi('/users/register/', {
                method: 'POST',
                body: JSON.stringify({
                    username: name,
                    email: email,
                    password: password,
                    gender: gender,
                    age: age ? parseInt(age) : 18
                })
            });

            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            router.push('/onboarding');
        } catch (error: any) {
            setErrorMsg(error?.message || "Registration failed. Please check your details.");
            setIsSubmitting(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            const data = await fetchApi('/users/google-login/', {
                method: 'POST',
                body: JSON.stringify({ id_token: credentialResponse.credential })
            });
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            window.location.href = '/dashboard';
        } catch (error: any) {
            console.error(error);
            setErrorMsg("Google authentication failed. Please try again.");
            setIsSubmitting(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId={clientId}>
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#dcedec] via-[#f5f3ed] to-[#fadac0] text-slate-900 p-4">
                {/* Texture Layer */}
                <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-white/60 blur-[150px] rounded-full mix-blend-overlay pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-2xl p-6 sm:p-10 relative z-20 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] rounded-[32px]"
                >
                    {/* Branding & Header */}
                    <div className="flex flex-col items-center mb-8 relative">
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            className="absolute left-0 top-0 text-slate-400 hover:text-slate-600 transition-colors p-2"
                            title="Return to Login"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="scale-100 mb-2">
                            <Logo />
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold mt-2">
                            Join the Network
                        </div>
                    </div>

                    {/* Google Signup Section */}
                    <div className="mb-8 flex flex-col items-center">
                        <div className="w-full flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => {
                                    console.error('Google Signup Error: Token retrieval failed. Check Authorized Origins in Google Console.');
                                    setErrorMsg("Google Authentication failed. Please ensure http://localhost:3000 is authorized in your Google Console.");
                                }}
                                theme="outline"
                                shape="pill"
                                width="100%"
                                text="signup_with"
                            />
                        </div>
                        <div className="mt-8 flex items-center w-full gap-4">
                            <div className="h-px bg-slate-200 flex-1" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">or manually set profile</span>
                            <div className="h-px bg-slate-200 flex-1" />
                        </div>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-6">
                        {/* Error Display */}
                        {errorMsg && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-600 text-xs font-semibold"
                            >
                                <Terminal className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                                <span>{errorMsg}</span>
                            </motion.div>
                        )}

                        {/* Form Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Username Input */}
                            <div className="space-y-2 group">
                                <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                    <span>Username</span>
                                    <Network className="w-3 h-3 opacity-50" />
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all"
                                        placeholder="Choose a handle"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email Input */}
                            <div className="space-y-2 group">
                                <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                    <span>Email Address</span>
                                    <AtSign className="w-3 h-3 opacity-50" />
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all transition-all"
                                        placeholder="user@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-2 group">
                                <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                    <span>Password</span>
                                    <Fingerprint className="w-3 h-3 opacity-50" />
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium tracking-widest text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all transition-all"
                                        placeholder="••••••••••••"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] font-medium text-slate-400 pl-1">Min 8 characters recommended</p>
                            </div>

                            {/* Demographics Row */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Gender */}
                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
                                        <span>Gender</span>
                                        <Dna className="w-3 h-3 opacity-50" />
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                            className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 focus:outline-none focus:border-slate-300 focus:bg-white transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="M">MALE</option>
                                            <option value="F">FEMALE</option>
                                            <option value="O">OTHER</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Age */}
                                <div className="space-y-2 group">
                                    <label className="text-[13px] font-semibold text-slate-600 flex items-center justify-between">
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
                                            className="w-full bg-white/60 border border-white shadow-inner rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all transition-all"
                                            placeholder="18"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Compliance Section */}
                        <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 flex items-start gap-4">
                            <input
                                type="checkbox"
                                required
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                            />
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Safety Agreement</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                                    I agree to use Glysmork for high-trust connections only. I will not engage in harassment or broadcast explicit content. Violating these terms results in a permanent ban.
                                </p>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`relative w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900 py-4 font-bold text-[15px] text-white transition-all hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(15,23,42,0.15)] focus:outline-none ${isSubmitting ? 'opacity-70 scale-95 hover:scale-95 cursor-wait' : ''}`}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isSubmitting ? 'HYDRATING ACCOUNT...' : (
                                        <>
                                            Initialize Profile
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </GoogleOAuthProvider>
    );
}
