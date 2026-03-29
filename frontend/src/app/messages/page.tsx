"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import Header from '@/components/Header';
import { MessageSquare, Clock, ArrowRight, User, Trash2, Users, UserCheck, UserPlus, X, Phone, Video, ArrowLeft } from 'lucide-react';
import { useNotification } from '@/components/NotificationProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


export default function InboxPage() {
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState<string | null>(null);
    const [ringingUsername, setRingingUsername] = useState<string | null>(null);
    const { sendSignal } = useNotification();
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

        const handleCallAccepted = (e: any) => {
            if (e.detail) {
                window.location.href = `/chat/room?id=${e.detail}`;
            }
        };

        const handleCallDeclined = () => {
            setRingingUsername(null);
            alert("The user declined your connection request.");
        };

        window.addEventListener('sys_call_answered', handleCallAccepted);
        window.addEventListener('sys_call_declined', handleCallDeclined);

        return () => {
            window.removeEventListener('sys_call_answered', handleCallAccepted);
            window.removeEventListener('sys_call_declined', handleCallDeclined);
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
                    <h1 className="text-4xl font-bold tracking-tight mb-2 italic">Messages</h1>
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
                        {/* Unread Messages (Notifications) */}
                        {chatNotifs.length > 0 && (
                            <section>
                                <h2 className="text-xs font-sans text-[13px] font-medium text-purple-400 uppercase tracking-widest mb-6 border-b border-purple-500/20 pb-2">Unread Messages</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {chatNotifs.map(n => (
                                        <div key={n.id} className="p-4 bg-white/80 border border-purple-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white rounded-none border border-purple-400/50">
                                                    {n.sender.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-900  uppercase tracking-tight">{n.sender}</span>
                                                    <p className="text-[10px] text-gray-400 font-sans text-[13px] font-medium italic">
                                                        {n.message.includes('missed') ? 'Missed connection attempt' : 'Wants to communicate with you!'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/messages/${n.sender}`}
                                                    className="px-3 py-1.5 bg-purple-500/20 text-purple-300 font-sans text-[13px] font-medium text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-purple-500 hover:text-white transition-all"
                                                    onClick={async () => {
                                                        await fetchApi('/matchmaking/notifications/', {
                                                            method: 'POST', body: JSON.stringify({ ids: [n.id] })
                                                        });
                                                    }}
                                                >
                                                    Message
                                                </Link>
                                                <button
                                                    onClick={async () => {
                                                        await fetchApi('/matchmaking/notifications/', {
                                                            method: 'POST', body: JSON.stringify({ ids: [n.id] })
                                                        });
                                                        setChatNotifs(prev => prev.filter(x => x.id !== n.id));
                                                    }}
                                                    className="px-2 py-1.5 bg-red-500/10 text-red-400 font-sans text-[13px] font-medium text-[10px] uppercase border border-red-500/30 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                    title="Dismiss"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Pending Requests Received */}
                        {friendsData.received.length > 0 && (
                            <section>
                                <h2 className="text-xs font-sans text-[13px] font-medium text-slate-500 uppercase tracking-widest mb-6 border-b border-cyan-500/20 pb-2">Inbound Connection Requests</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendsData.received.map(f => (
                                        <div key={f.id} className="p-4 bg-white/80 border border-slate-200/60 shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/10 flex items-center justify-center font-bold text-slate-900 ">{f.username.charAt(0).toUpperCase()}</div>
                                                <span className="font-bold text-slate-900  uppercase tracking-tight">{f.username}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleFriendAction(f.username, 'accept')}
                                                    className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                                                >
                                                    <UserCheck className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleFriendAction(f.username, 'decline')}
                                                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        
                        {/* Your Connections (Friends) */}
                        {friendsData.friends.length > 0 && (
                            <section>
                                <h2 className="text-xs font-sans text-[13px] font-medium text-slate-500 uppercase tracking-widest mb-6 border-b border-cyan-500/20 pb-2">Your Connections</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendsData.friends.map(f => (
                                        <div key={f.id} className="p-4 bg-white/80 border border-slate-200/60 shadow-sm flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-white rounded-none border border-cyan-400/50 shadow-md">
                                                        {f.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    {f.is_online && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#050511] animate-pulse" />
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-900  uppercase tracking-tight block leading-tight">{f.username}</span>
                                                    <span className={`text-[9px] font-sans text-[13px] font-medium uppercase ${f.is_online ? 'text-green-400' : 'text-gray-500'}`}>
                                                        {f.is_online ? 'Online' : 'Offline'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/messages/${f.username}`}
                                                    className="p-2 bg-cyan-500/10 text-slate-500 hover:bg-cyan-500 hover:text-black transition-all border border-cyan-500/20"
                                                    title="Send Message"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleFriendAction(f.username, 'remove')}
                                                    className="p-2 bg-red-500/10 text-red-100 hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
                                                    title="Remove Connection"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
