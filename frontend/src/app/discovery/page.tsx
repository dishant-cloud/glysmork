'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MessageSquare, Video, Phone, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import { fetchApi } from '@/lib/api';
import LocationPicker from '@/components/LocationPicker';

export default function DiscoveryPage() {
    const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
    const [searchingIntent, setSearchingIntent] = useState<string>('');
    const [friendRequested, setFriendRequested] = useState<Set<string>>(new Set());
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);

    const getUsername = () => {
        const u = localStorage.getItem('user');
        if (u) {
            try { return JSON.parse(u).username; } catch { }
        }
        return null;
    };

    // Load from sessionStorage
    useEffect(() => {
        try {
            const storedResults = sessionStorage.getItem('glysmork_discovery_results');
            if (storedResults) {
                const parsed = JSON.parse(storedResults);
                if (parsed && parsed.length > 0) setDiscoveryResults(parsed);
            }
            
            const storedIntent = sessionStorage.getItem('glysmork_searching_intent');
            if (storedIntent) {
                setSearchingIntent(storedIntent);
                // Clear it so Dashboard doesn't restart search on back navigation
                sessionStorage.removeItem('glysmork_searching_intent');
            }
        } catch { }
    }, []);

    const startCall = (partner: string, type: 'audio' | 'video', roomName: string) => {
        // Redirect to video call interface
        window.location.href = `/chat/room?id=${roomName}&mode=${type}&partner=${partner}`;
    };

    const endCall = () => {
        setRingingUsername(null);
    };

    return (
        <main className="min-h-screen relative bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] text-slate-900 overflow-y-auto selection:bg-cyan-500/30 font-sans">
            <Header />

            <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-12 pt-32 pb-20">
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <button 
                            onClick={() => window.location.href = '/dashboard'}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest mb-4 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                        </button>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase" >
                            Network Results
                        </h2>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            {searchingIntent && <p className="text-slate-500 text-sm font-medium">AI synthesized candidates for: &quot;{searchingIntent}&quot;</p>}
                            <LocationPicker />
                        </div>
                    </div>
                </div>

                {discoveryResults.length === 0 ? (
                    <div className="py-20 text-center text-slate-500 font-semibold">
                        No results loaded. Please initiate a search from the dashboard.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {discoveryResults.map((result, idx) => (
                            <motion.div
                                key={result.username}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white border border-slate-200/50 p-6 flex flex-col relative rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="absolute top-3 right-3">
                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-900 border border-slate-200 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                                        {result.score}% Compatibility
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                            {result.username.charAt(0).toUpperCase()}
                                        </div>
                                        {result.is_online && (
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white shadow-sm" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-slate-900 font-bold text-lg leading-none mb-1.5">{result.username}</h4>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${result.is_online ? 'text-green-600' : 'text-slate-400'}`}>
                                            {result.is_online ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-3">
                                    {result.match_tags?.map((tag: string) => (
                                        <span key={tag} className="text-[10px] font-medium text-slate-800 border border-slate-200/50 bg-white/50 px-2 py-0.5 rounded-full">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                <p className="text-slate-500 text-sm mb-4 line-clamp-3 leading-relaxed border-l-2 border-slate-200/50 pl-3">
                                    {result.reason}
                                </p>

                                <div className="mb-4 grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[9px] font-semibold text-slate-400 uppercase block mb-1">Expertise</span>
                                        <div className="text-xs text-slate-600 truncate">{result.expertise?.join(', ') || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-semibold text-slate-400 uppercase block mb-1">Interests</span>
                                        <div className="text-xs text-slate-600 truncate">{result.interests?.join(', ') || 'N/A'}</div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                fetch('http://127.0.0.1:8000/api/matchmaking/notify/', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        sender: getUsername(),
                                                        receiver: result.username,
                                                        room_name: `direct_${[getUsername(), result.username].sort().join('_')}`,
                                                    }),
                                                }).catch(() => { });
                                                window.location.href = `/messages/${result.username}`;
                                            }}
                                            className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white hover:bg-slate-800 transition-all font-semibold text-xs rounded-full"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Message
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (friendRequested.has(result.username)) return;
                                                try {
                                                    await fetchApi('/matchmaking/friends/', {
                                                        method: 'POST',
                                                        body: JSON.stringify({
                                                            username: getUsername(),
                                                            target_username: result.username,
                                                            action: 'request',
                                                        }),
                                                    });
                                                    setFriendRequested(prev => new Set([...prev, result.username]));
                                                } catch { }
                                            }}
                                            className={`flex items-center justify-center gap-2 py-2.5 border transition-all font-semibold text-xs rounded-full ${friendRequested.has(result.username)
                                                ? 'bg-green-50 border-green-200 text-green-600 cursor-default'
                                                : 'bg-white/50 border-slate-200/50 text-slate-800 hover:bg-white/60'
                                                }`}
                                        >
                                            <User className="w-3.5 h-3.5" />
                                            {friendRequested.has(result.username) ? 'Requested' : 'Connect'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
