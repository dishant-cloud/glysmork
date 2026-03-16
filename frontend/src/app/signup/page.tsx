"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUp() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState('O');
    const [age, setAge] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % 7); // "SIGN UP" -> 7 chars.
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsSubmitting(true);

        try {
            const data = await fetch('http://localhost:8000/api/users/register/', {
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
            router.push('/onboarding');
        } catch (error: any) {
            setErrorMsg(error?.message || "Network error. Is the backend running?");
            setIsSubmitting(false);
        }

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

                {errorMsg && (
                    <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-2 rounded-lg text-sm mb-4 w-full max-w-2xl text-center">
                        {errorMsg}
                    </div>
                )}

                {/* Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">

                    {/* Row 1, Col 1: Username */}
                    <div>
                        <label className="block text-base font-medium text-gray-400 mb-1">Username</label>
                        <input
                            type="text"
                            required
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
                            required
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
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            placeholder="••••••••"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            8+ chars, not all numeric.
                        </p>
                    </div>

                    {/* Row 2, Col 2: Demographics */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-base font-medium text-gray-400 mb-1">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full px-3 py-2 h-[42px] bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all appearance-none"
                            >
                                <option value="M" className="bg-slate-900">Male</option>
                                <option value="F" className="bg-slate-900">Female</option>
                                <option value="O" className="bg-slate-900">Other</option>
                            </select>
                        </div>
                        <div className="flex-[0.5]">
                            <label className="block text-base font-medium text-gray-400 mb-1">Age</label>
                            <input
                                type="number"
                                required
                                min="18"
                                max="100"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                className="w-full px-3 py-2 h-[42px] bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm text-base text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                                placeholder="18"
                            />
                        </div>
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
                        disabled={isSubmitting}
                        className={`bg-gray-700/40 hover:bg-gray-600/60 text-white font-bold py-2 px-12 rounded-full shadow-lg transition-all hover:scale-105 backdrop-blur-sm border border-gray-500/30 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isSubmitting ? 'Connecting...' : 'Sign Up'}
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
