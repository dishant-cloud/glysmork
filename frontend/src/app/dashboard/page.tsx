"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [intent, setIntent] = useState('');
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const u = localStorage.getItem('user');
        if (u) {
            try {
                const userData = JSON.parse(u);
                setUsername(userData.username);
            } catch (e) {
                console.error("Failed to parse user data");
            }
        }
    }, []);

    const startRandomMatching = async () => {
        setIsMatching(true);
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: "Random Connection" })
            });

            if (response.match_found || response.room_name) {
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                alert("Searching the network for a random node. You will be connected shortly.");
                setIsMatching(false);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
            alert("Failed to initiate random matchmaking. Please try again.");
        }
    };

    const startMatching = async () => {
        if (!intent.trim()) return;

        setIsMatching(true);
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intent })
            });

            if (response.match_found || response.room_name) {
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                alert("Searching for the perfect match. You'll be notified once someone fitting your intent is found.");
                setIsMatching(false);
            }
        } catch (error) {
            console.error(error);
            setIsMatching(false);
            alert("Failed to initiate matchmaking. Please try again.");
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-contain bg-center bg-no-repeat relative px-4 bg-black text-white"
            style={{ backgroundImage: `url('/glysmork_signup.png')` }}
        >
            <div className="w-full max-w-xl p-8 relative z-10 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 mb-2">
                        DASHBOARD
                    </h2>
                    <p className="text-gray-400">
                        Welcome to your Neural Node{username ? `, ` : ''}
                        {username && <span className="text-cyan-400 font-mono font-bold tracking-widest ml-1">{username.toUpperCase()}</span>}
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-2">AI Intent Matchmaking</h3>
                        <p className="text-sm text-gray-400 mb-4">Describe the profound connection you seek:</p>

                        <div className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={intent}
                                onChange={(e) => setIntent(e.target.value)}
                                placeholder="e.g. Someone to discuss machine learning with"
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl backdrop-blur-sm text-white placeholder-gray-500 focus:border-cyan-400 focus:bg-white/20 focus:outline-none transition-all"
                            />

                            <button
                                onClick={startMatching}
                                disabled={!intent.trim() || isMatching}
                                className={`w-full bg-cyan-800/40 hover:bg-cyan-100/60 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all hover:scale-[1.02] backdrop-blur-sm border border-cyan-500/30 ${isMatching || !intent.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isMatching ? "Scanning Network..." : "Find Specific Match"}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 my-4 opacity-50">
                        <div className="flex-1 h-px bg-white/30"></div>
                        <span className="font-mono text-xs uppercase">or</span>
                        <div className="flex-1 h-px bg-white/30"></div>
                    </div>

                    <div>
                        <button
                            onClick={startRandomMatching}
                            disabled={isMatching}
                            className={`w-full bg-purple-900/40 hover:bg-purple-800/60 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all hover:scale-[1.02] backdrop-blur-sm border border-purple-500/30 font-mono uppercase tracking-widest ${isMatching ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isMatching ? "Routing..." : "Random Connection"}
                        </button>
                    </div>

                    <div className="pt-6 border-t border-white/10 flex justify-between items-center text-sm">
                        <Link href="/" className="text-gray-500 hover:text-cyan-400 font-mono transition-colors">
                            « Home
                        </Link>
                        <div className="flex gap-4 items-center">
                            <Link href="/profile" className="text-purple-400 hover:text-purple-300 font-mono text-xs uppercase transition-colors border-b border-purple-500/30 hover:border-purple-400 pb-1">
                                [View Neural Profile]
                            </Link>
                            <button
                                onClick={() => {
                                    localStorage.removeItem('user');
                                    localStorage.removeItem('access_token');
                                    localStorage.removeItem('refresh_token');
                                    window.location.href = '/login';
                                }}
                                className="text-red-500 hover:text-red-400 font-mono transition-colors border border-red-500/30 hover:border-red-400 px-3 py-1 rounded-md text-xs"
                            >
                                [DISCONNECT]
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
