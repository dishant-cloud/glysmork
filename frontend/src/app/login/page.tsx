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
            router.replace('/dashboard');
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
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Neural Authentication Failed. Verification denied.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020205] text-cyan-50">
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 bg-[url('/glysmork_signup.png')] bg-cover bg-center opacity-30 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-[#020205] z-0" />
            <div className="absolute inset-0 bg-noise z-10" />
            
            {/* Floating Orbs */}
            <motion.div 
                animate={{ x: [0, 30, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }} 
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-[20%] left-[20%] w-[30vw] h-[30vw] min-w-[300px] min-h-[300px] bg-cyan-600/20 blur-[120px] rounded-full z-0"
            />
            <motion.div 
                animate={{ x: [0, -40, 0], y: [0, 40, 0], scale: [1, 1.5, 1] }} 
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-[10%] right-[10%] w-[40vw] h-[40vw] min-w-[400px] min-h-[400px] bg-purple-900/20 blur-[150px] rounded-full z-0"
            />

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
                            <span>NEURAL_ID</span>
                            <Network className="w-3 h-3 opacity-50" />
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/40 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm font-mono text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/20 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-focus-within:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                                placeholder="ENTER IDENTIFIER"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-mono tracking-[0.2em] text-purple-500 uppercase flex items-center justify-between">
                            <span>ACCESS_KEY</span>
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
                                {isLoading ? 'AUTHENTICATING...' : (
                                    <>
                                        ESTABLISH_CONNECTION
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
                        UNREGISTERED NODE?{' '}
                        <button
                            onClick={() => router.push('/signup')}
                            className="text-cyan-500 transition-colors hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] focus:outline-none"
                        >
                            [ INIT_REGISTRATION ]
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
