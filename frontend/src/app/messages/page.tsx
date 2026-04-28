"use client";

import { useState, useEffect } from 'react';
import { fetchApi, getMediaUrl } from '@/lib/api';
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
        friends: { id: number, username: string, is_online?: boolean, profile_image?: string | null }[],
        received: { id: number, username: string, profile_image?: string | null }[],
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


        
        const handleNewNotif = () => {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    const u = JSON.parse(stored);
                    if (u.username) fetchNotifs(u.username);
                } catch {}
            }
        };
        window.addEventListener('sys_friend_message', handleNewNotif);

        return () => {

            window.removeEventListener('sys_friend_message', handleNewNotif);
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
                    <h1 className="text-4xl font-bold tracking-tight mb-2 italic">Notifications</h1>
                    <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-indigo-600 mb-6" />
                    <p className="font-sans text-[13px] font-medium text-sm text-slate-500 ">
                        Recent activity and incoming message requests.
                    </p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <div className="w-10 h-10 border-2 border-t-purple-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin mb-4" />
                        <span className="font-sans text-[13px] font-medium text-xs uppercase tracking-widest">Checking Sync...</span>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Unread Messages (Notifications) */}
                        {chatNotifs.length > 0 && (
                            <section>
                                <h2 className="text-xs font-sans text-[13px] font-medium text-purple-400 uppercase tracking-widest mb-6 border-b border-purple-500/20 pb-2">New Messages</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {chatNotifs.map(n => (
                                        <div key={n.id} className="p-4 bg-white/80 border border-purple-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/50 shrink-0 flex items-center justify-center">
                                                    {(n as any).profile_image ? (
                                                        <img src={getMediaUrl((n as any).profile_image)} alt={n.sender} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="font-black text-white">{n.sender.charAt(0).toUpperCase()}</span>
                                                    )}
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

                        {/* Friend Requests Section */}
                        {friendsData.received && friendsData.received.length > 0 && (
                            <section>
                                <h2 className="text-xs font-sans text-[13px] font-medium text-emerald-400 uppercase tracking-widest mb-6 border-b border-emerald-500/20 pb-2">Friend Requests</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {friendsData.received.map(req => (
                                        <div key={req.id} className="p-4 bg-white/80 border border-emerald-500/30 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-emerald-500 to-teal-600 border border-emerald-400/50 shrink-0 flex items-center justify-center">
                                                    {req.profile_image ? (
                                                        <img src={getMediaUrl(req.profile_image)} alt={req.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="font-black text-white">{req.username.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-900 uppercase tracking-tight">{req.username}</span>
                                                    <p className="text-[10px] text-gray-400 font-sans text-[13px] font-medium italic">
                                                        Wants to be friends!
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleFriendAction(req.username, 'accept')}
                                                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-600 font-sans text-[13px] font-medium text-[10px] uppercase tracking-widest border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                                                >
                                                    <UserCheck className="w-3 h-3" /> Accept
                                                </button>
                                                <button
                                                    onClick={() => handleFriendAction(req.username, 'reject')}
                                                    className="px-2 py-1.5 bg-red-500/10 text-red-400 font-sans text-[13px] font-medium text-[10px] uppercase border border-red-500/30 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                    title="Reject"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Empty State */}
                        {chatNotifs.length === 0 && (!friendsData.received || friendsData.received.length === 0) && (
                            <div className="flex flex-col items-center justify-center py-20 bg-white/40 border border-dashed border-slate-200">
                                <MessageSquare className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-sm font-sans text-[13px] font-medium text-slate-400 italic">No new notifications. You're all caught up!</p>
                                <button 
                                    onClick={() => router.push('/friends')}
                                    className="mt-6 px-4 py-2 bg-slate-900 text-white text-[11px] uppercase tracking-widest font-bold hover:bg-slate-800 transition-all"
                                >
                                    View Friends List
                                </button>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </main>
    );
}
