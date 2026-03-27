"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Network, Fingerprint, ChevronRight } from 'lucide-react';
import Logo from '@/components/Logo';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const existingUser = localStorage.getItem('user');
        if (existingUser) {
            try {
                const parsed = JSON.parse(existingUser);
                if (parsed?.username) {
                    router.replace('/dashboard');
                    return;
                }
            } catch {}
            // Malformed or missing username — clear it
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }, [router]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const data = await fetchApi('/users/login/', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            localStorage.setItem('user', JSON.stringify(data.user));
            if (data.access) localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Login failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent text-cyan-50">
            {/* Texture Layer */}
            <div className="bg-noise dark:opacity-5 opacity-20 fixed inset-0 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md p-8 sm:p-10 relative z-20 ultra-glass rounded-3xl"
            >
                {/* Branding Header */}
                <div className="flex flex-col items-center mb-10 mt-2">
                    <div className="scale-125 mb-6 opacity-90 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                        <Logo />
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Username Input */}
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-mono tracking-[0.2em] text-cyan-500 uppercase flex items-center justify-between">
                            <span>Username</span>
                            <Network className="w-3 h-3 opacity-50" />
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                placeholder="Enter your username"
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
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono tracking-widest text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:bg-purple-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`relative w-full overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-900/40 via-purple-900/40 to-cyan-900/40 py-4 font-mono text-sm tracking-widest text-cyan-100 uppercase transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black ${isLoading ? 'opacity-70 scale-95 hover:scale-95' : ''}`}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isLoading ? 'Logging in...' : (
                                    <>
                                        Login
                                        <ChevronRight className="w-4 h-4 animate-pulse" />
                                    </>
                                )}
                            </span>
                            {/* Hover Sweep Effect */}
                            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent hover:animate-[sweep_1.5s_ease-in-out_infinite]" />
                        </button>
                    </div>
                </form>

                {/* Footer Links */}
                <div className="mt-8 flex flex-col items-center gap-4 text-xs font-mono text-slate-500">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                    <p className="tracking-wide">
                        New here?{' '}
                        <button
                            onClick={() => router.push('/signup')}
                            className="text-cyan-500 transition-colors hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] focus:outline-none"
                        >
                            Create an Account
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
