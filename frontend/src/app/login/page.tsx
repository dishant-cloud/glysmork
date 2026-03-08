"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % 7); // 7 is length of "WELCOME"
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const data = await fetchApi('/users/login/', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            // Save basic user info for the UI
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            alert("Invalid credentials. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-contain bg-center bg-no-repeat relative px-4 bg-black"
            style={{ backgroundImage: `url('/glysmork_signup.png')` }}
        >
            <div className="w-full max-w-sm p-8 relative z-10">

                <div className="text-center mb-8 h-14 flex items-end justify-center">
                    <h1 className="text-3xl font-bold tracking-[0.2em] flex justify-center gap-1">
                        {['W', 'E', 'L', 'C', 'O', 'M', 'E'].map((letter, index) => (
                            <span
                                key={index}
                                className={`transition-all duration-300 inline-block ${index === activeIndex
                                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 text-4xl -translate-y-2'
                                    : 'text-gray-500'
                                    }`}
                            >
                                {letter}
                            </span>
                        ))}
                    </h1>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">

                    {/* Username Input */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="Your Username"
                            required
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {/* Login Button */}
                    <div className="flex justify-center">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`bg-cyan-800/40 hover:bg-cyan-100/60 text-white font-bold py-2 px-8 rounded-full shadow-lg transition-all hover:scale-105 backdrop-blur-sm border border-cyan-500/30 ${isLoading ? 'opacity-50' : ''}`}
                        >
                            {isLoading ? 'Processing...' : 'Login'}
                        </button>
                    </div>

                </form>

                {/* Sign Up Link */}
                <div className="mt-6 text-center text-gray-300">
                    Don't have an account?{' '}
                    <button
                        onClick={() => router.push('/signup')}
                        className="text-emerald-500 hover:text-emerald-400 font-medium hover:underline cursor-pointer"
                    >
                        Sign up here
                    </button>
                </div>

            </div>
        </div>
    );
}
