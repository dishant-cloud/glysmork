"use client";

import { useState } from 'react';
import { fetchApi } from '@/lib/api';

export default function Dashboard() {
    const [isMatching, setIsMatching] = useState(false);
    const [intent, setIntent] = useState('');

    const startMatching = async () => {
        if (!intent.trim()) return;

        setIsMatching(true);
        try {
            const response = await fetchApi('/matchmaking/join/', {
                method: 'POST',
                body: JSON.stringify({ intent: intent })
            });

            if (response.match_found || response.room_name) {
                // If match found immediately
                window.location.href = `/chat/room?id=${response.room_name}`;
            } else {
                // If added to loop, we can wait or show a message
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
                    <p className="text-gray-400">Welcome to your Neural Node</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-2">AI Matchmaking</h3>
                        <p className="text-sm text-gray-400 mb-4">Describe the kind of person or topic you're looking for:</p>

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
                                {isMatching ? "Scanning Network..." : "Find Match"}
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/10 text-center">
                        <a href="/" className="text-sm text-gray-500 hover:text-cyan-400 transition-colors">
                            Return to Home
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
