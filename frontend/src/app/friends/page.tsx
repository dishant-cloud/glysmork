"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Header from '@/components/Header';
import { MessageSquare, Clock, ArrowRight, User, Trash2, Users, UserCheck, UserPlus, X, Phone, Video, ArrowLeft } from 'lucide-react';
import { useNotification } from '@/components/NotificationProvider';
import { useCall } from '@/components/CallProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FriendsPage() {
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState<string | null>(null);
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);
    const { sendSignal } = useNotification();
    const { startCall } = useCall();
    const router = useRouter();
    const [friendsData, setFriendsData] = useState<{
        friends: { id: number, username: string, is_online?: boolean }[],
        received: { id: number, username: string }[],
        sent: { id: number, username: string }[]
    }>({ friends: [], received: [], sent: [] });
    const [chatNotifs, setChatNotifs] = useState<{ id: number; sender: string; message: string; room_name: string }[]>([]);



    useEffect(() => {
        const u = localStorage.getItem('user');
        if (!u) {
            window.location.replace('/login');
            return;
        }
        try {
            const data = JSON.parse(u);
            setUsername(data.username);
            fetchFriends(data.username);
            fetchNotifs(data.username);
            setLoading(false);
        } catch (e) {
            window.location.replace('/login');
        }



        return () => {

        };
    }, []);


    const fetchFriends = async (currUser: string) => {
        try {
            const res = await fetchApi(`/matchmaking/friends/?username=${encodeURIComponent(currUser)}`);
            setFriendsData(res);
        } catch (e) {
            console.error("Failed to fetch friends", e);
        }
    };

    const fetchNotifs = async (currUser: string) => {
        try {
            const res = await fetchApi(`/matchmaking/notifications/?username=${encodeURIComponent(currUser)}`);
            if (res.notifications) setChatNotifs(res.notifications);
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    };

    const handleFriendAction = async (target: string, action: string) => {
        if (!username) return;
        try {
            await fetchApi('/matchmaking/friends/', {
                method: 'POST',
                body: JSON.stringify({
                    username: username,
                    target_username: target,
                    action: action
                })
            });
            fetchFriends(username);
        } catch (e) { console.error(e); }
    };

    return (
        <main className="min-h-screen bg-[#fafaf9] text-slate-900 transition-colors duration-300 overflow-hidden">

            <Header />

            <div className="relative z-10 w-full max-w-4xl mx-auto pt-40 pb-20 px-6">
                <header className="mb-12">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 text-xs font-sans text-[13px] font-medium text-gray-400 hover:text-slate-500 transition-colors mb-6 uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-3 h-3" /> Back to Dashboard
                    </button>
                    <h1 className="text-4xl font-bold tracking-tight mb-2 italic">Your Connections</h1>
                    <div className="h-1 w-20 bg-gradient-to-r from-cyan-500 to-purple-600 mb-6" />

                    <p className="font-sans text-[13px] font-medium text-sm text-slate-500 ">
                        Persistent human connections verified by the AI engine.
                    </p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <div className="w-10 h-10 border-2 border-t-cyan-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin mb-4" />
                        <span className="font-sans text-[13px] font-medium text-xs uppercase tracking-widest">Accessing Logs...</span>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Friends List */}
                        <section>
                            <h2 className="text-xs font-sans text-[13px] font-medium text-slate-800 uppercase tracking-widest mb-6 border-b border-cyan-500/20 pb-2">Your Connections (Friends)</h2>
                            {friendsData.friends.length === 0 ? (
                                <p className="text-sm font-sans text-[13px] font-medium text-slate-500 py-4 italic text-center">No connections found. Add friends from the chat or discovery pages.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendsData.friends.map(f => {
                                        const isOffline = !f.is_online;
                                        const isRinging = ringingUsername === f.username;

                                        return (
                                            <div key={f.id} className="p-6 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col justify-between group">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center text-white font-black border border-slate-200/60 shadow-sm">
                                                            {f.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black uppercase tracking-widest text-sm">{f.username}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${f.is_online ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                                                                <span className="text-[10px] text-slate-500 font-sans text-[13px] font-medium">
                                                                    {f.is_online ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mt-auto">
                                                    <Link
                                                        href={`/messages/${f.username}`}
                                                        className="flex flex-col items-center justify-center py-2 border border-slate-200 text-slate-500 font-sans text-[13px] font-medium text-[9px] uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all"
                                                    >
                                                        <MessageSquare className="w-4 h-4 mb-1 opacity-60" />
                                                        Chat
                                                    </Link>

                                                    {[
                                                        { icon: Phone, mode: 'audio', label: 'Audio' },
                                                        { icon: Video, mode: 'video', label: 'Video' }
                                                    ].map((btn) => (
                                                        <button
                                                            key={btn.mode}
                                                            disabled={isOffline || isRinging}
                                                            onClick={() => {
                                                                const sortedUsernames = [username, f.username].sort();
                                                                const room_name = `direct_${sortedUsernames[0]}_${sortedUsernames[1]}`;
                                                                startCall(f.username, btn.mode as 'audio' | 'video', room_name);
                                                            }}
                                                            className={`flex flex-col items-center justify-center py-2 bg-white/60 border transition-all ${isOffline
                                                                ? 'opacity-30 cursor-not-allowed border-slate-700'
                                                                : isRinging
                                                                    ? 'bg-cyan-500/20 text-slate-500 border-cyan-400 animate-pulse'
                                                                    : 'hover:bg-cyan-500 hover:text-black hover:border-cyan-400 border-slate-200 text-slate-500'
                                                                }`}
                                                            title={isOffline ? 'User offline' : btn.label}
                                                        >
                                                            <btn.icon className={`w-4 h-4 mb-1 ${isRinging ? 'opacity-100' : 'opacity-60'}`} />
                                                            <span className="text-[9px] font-sans text-[13px] font-medium uppercase tracking-widest">
                                                                {isRinging ? 'Ringing...' : btn.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Sent Requests */}
                        {friendsData.sent.length > 0 && (
                            <section className="opacity-60 grayscale hover:grayscale-0 transition-all">
                                <h2 className="text-xs font-sans text-[13px] font-medium text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-200/60 shadow-sm pb-2">Sent Friend Requests (Pending)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendsData.sent.map(f => (
                                        <div key={f.id} className="p-4 bg-white/80 border border-slate-200/60 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/10 flex items-center justify-center font-sans text-[13px] font-medium text-xs italic">USER</div>
                                                <span className="font-bold text-slate-400">{f.username}</span>
                                            </div>
                                            <button
                                                onClick={() => handleFriendAction(f.username, 'cancel')}
                                                className="text-[10px] font-sans text-[13px] font-medium text-red-400 uppercase tracking-tighter hover:underline"
                                            >
                                                [ Revoke ]
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
