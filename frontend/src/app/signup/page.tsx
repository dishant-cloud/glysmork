"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUp() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % 7); // "SIGN UP" -> 7 chars.
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleSignUp = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Signing up with:', name, email, password);
        // Note: Django API backend does not have a register endpoint yet.
        // For now, redirect to login or onboarding
        alert("Signup feature is linked to Django layout. Redirecting to onboarding for AI Analysis!");
        router.push('/onboarding');
    };

    return (
        <div
            className="min-h-screen relative bg-contain bg-center bg-no-repeat bg-black"
            style={{ backgroundImage: `url('/glysmork_signup.png')` }}
        >
            <div className="absolute top-10 left-0 right-0 text-center z-20">
                <h1 className="text-3xl font-bold tracking-[0.2em] flex justify-center gap-1">
                    {['S', 'I', 'G', 'N', ' ', 'U', 'P'].map((letter, index) => (
                        <span
                            key={index}
                            className={`transition-all duration-300 inline-block ${letter === ' ' ? 'w-4' : ''} ${index === activeIndex
                                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 text-4xl -translate-y-2'
                                : 'text-gray-500'
                                }`}
                        >
                            {letter}
                        </span>
                    ))}
                </h1>
            </div>

            <form onSubmit={handleSignUp} className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-6 bg-gradient-to-t from-black/90 to-transparent">



                {/* Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">

                    {/* Row 1, Col 1: Username */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Username</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="Username"
                        />
                    </div>

                    {/* Row 1, Col 2: Email */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="you@example.com"
                        />
                    </div>

                    {/* Row 2, Col 1: Password */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="••••••••"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            8+ chars, not all numeric.
                        </p>
                    </div>

                    {/* Row 2, Col 2: Password Confirmation */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Password Confirmation</label>
                        <input
                            type="password"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="••••••••"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Confirm verification.
                        </p>
                    </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="flex items-start gap-2 max-w-2xl justify-center bg-black/40 p-2 rounded-lg backdrop-blur-md">
                    <input
                        type="checkbox"
                        required
                        className="mt-1 w-4 h-4 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <label className="text-xs text-gray-300 leading-tight text-center">
                        I agree that this app is for FRIENDLY social connections only. I will <span className="font-bold text-red-400">NOT</span> share sexual content. I understand that violating these rules will result in an immediate ban.
                    </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="bg-gray-700/40 hover:bg-gray-600/60 text-white font-bold py-2 px-12 rounded-full shadow-lg transition-all hover:scale-105 backdrop-blur-sm border border-gray-500/30"
                    >
                        Sign Up
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/login')}
                        className="text-gray-400 hover:text-gray-200 font-medium hover:underline px-4 py-2"
                    >
                        Back to Login
                    </button>
                </div>

            </form>
        </div>
    );
}
