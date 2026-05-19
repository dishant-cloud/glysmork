"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { ShieldAlert, Users, TrendingUp, AlertTriangle, MessageSquare, IndianRupee, ArrowLeft, Ban, Brain, Zap, Search } from 'lucide-react';
import Link from 'next/link';

interface AdminAnalytics {
    retention: { day_1: string; day_7: string };
    toxicity: { total_reports: number; banned_users: number; flagged_users: number };
    engagement: { total_rooms: number; total_messages: number; qualifying_sessions: number };
    financials: { total_revenue_inr: number; projected_api_cost_usd: number; estimated_profit_inr: number };
    matchmaking_engine: {
        gemini_key_configured: boolean;
        gemini_key_preview: string;
        embedding_calls: number;
        embedding_successes: number;
        embedding_failures: number;
        fallback_keyword_used: number;
        total_searches: number;
        total_candidates_scored: number;
        matches_returned: number;
    };
    advanced: {
        plan_purchases: { plan__name: string; count: number }[];
        onboarding_completed: number;
        average_profit_per_person_inr: number;
        searches_today: {
            ai: number;
            standard: number;
            roulette: number;
        };
    };
}

export default function AdminDashboard() {
    const [data, setData] = useState<AdminAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const res = await fetchApi('/users/admin/analytics/');
                setData(res);
            } catch (err: any) {
                console.error("Admin Analytics Error", err);
                setError(err.message || "Failed to load admin data. Ensure you have admin privileges.");
            } finally {
                setLoading(false);
            }
        };
        fetchAdminData();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white"><div className="animate-spin w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full" /></div>;

    if (error) return (
        <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-6 text-center">
            <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-slate-400 max-w-md">{error}</p>
            <Link href="/dashboard" className="mt-6 px-6 py-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">Return to App</Link>
        </div>
    );

    if (!data) return null;

    const me = data.matchmaking_engine;
    const embeddingRate = me.embedding_calls > 0 ? ((me.embedding_successes / me.embedding_calls) * 100).toFixed(1) : "0.0";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-emerald-500/30">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-12 border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <ShieldAlert className="w-8 h-8 text-emerald-500" /> Phase 1 Command Center
                        </h1>
                        <p className="text-slate-500 mt-1">Highly classified internal metrics</p>
                    </div>
                    <Link href="/dashboard" className="p-2 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </Link>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Retention Card */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group">
                        <Users className="w-6 h-6 text-sky-400 mb-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Retention Funnel</h3>
                        <div className="flex justify-between items-end border-b border-slate-800 pb-4 mb-4">
                            <span className="text-slate-400">Day 1</span>
                            <span className="text-2xl font-black text-white">{data.retention.day_1}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-slate-400">Day 7</span>
                            <span className="text-2xl font-black text-sky-400">{data.retention.day_7}</span>
                        </div>
                    </div>

                    {/* Toxicity Card */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                        <AlertTriangle className="w-6 h-6 text-rose-500 mb-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Toxicity Index</h3>
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-slate-400">Total Reports</span>
                            <span className="text-xl font-bold text-white">{data.toxicity.total_reports}</span>
                        </div>
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-slate-400">Flagged Users</span>
                            <span className="text-xl font-bold text-amber-400">{data.toxicity.flagged_users}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-slate-400 flex items-center gap-2"><Ban className="w-4 h-4"/> Banned</span>
                            <span className="text-xl font-bold text-rose-500">{data.toxicity.banned_users}</span>
                        </div>
                    </div>

                    {/* Engagement Quality */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-2">
                        <MessageSquare className="w-6 h-6 text-violet-400 mb-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Matchmaking Quality</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Total Rooms</p>
                                <p className="text-3xl font-black text-white">{data.engagement.total_rooms}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Total Messages</p>
                                <p className="text-3xl font-black text-white">{data.engagement.total_messages}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide text-violet-300">Qualifying Sessions</p>
                                <p className="text-3xl font-black text-violet-400">{data.engagement.qualifying_sessions}</p>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-800">
                            <p className="text-xs text-slate-500">
                                * Qualifying sessions represent users who completed meaningful interactions (e.g., &gt; 2min chats).
                            </p>
                        </div>
                    </div>
                </div>

                {/* AI Engine Health Card */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 text-cyan-500/10 pointer-events-none">
                        <Brain className="w-64 h-64" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <Brain className="w-6 h-6 text-cyan-400" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-400">AI Engine Health</h3>
                        <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${me.gemini_key_configured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {me.gemini_key_configured ? '● ONLINE' : '● OFFLINE'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Gemini Key</p>
                            <p className="text-lg font-bold text-white font-mono">{me.gemini_key_preview}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Embedding Success Rate</p>
                            <p className={`text-3xl font-black ${parseFloat(embeddingRate) > 90 ? 'text-emerald-400' : parseFloat(embeddingRate) > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {embeddingRate}%
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Total Searches</p>
                            <p className="text-3xl font-black text-white">{me.total_searches}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Matches Returned</p>
                            <p className="text-3xl font-black text-cyan-400">{me.matches_returned}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-800">
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide flex items-center gap-1"><Zap className="w-3 h-3" /> Embedding Calls</p>
                            <p className="text-xl font-bold text-white">{me.embedding_calls}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Successes</p>
                            <p className="text-xl font-bold text-emerald-400">{me.embedding_successes}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide">Failures</p>
                            <p className="text-xl font-bold text-rose-400">{me.embedding_failures}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wide flex items-center gap-1"><Search className="w-3 h-3" /> Keyword Fallbacks</p>
                            <p className="text-xl font-bold text-amber-400">{me.fallback_keyword_used}</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                        <p className="text-xs text-slate-500">
                            * Stats are in-memory and reset on server restart. Candidates Scored: {me.total_candidates_scored}.
                        </p>
                    </div>
                </div>

                {/* Advanced Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Searches Breakdown */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                        <Search className="w-6 h-6 text-indigo-400 mb-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Today's Search Usage</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                <span className="text-slate-400">AI / LLM Searches</span>
                                <span className="text-xl font-bold text-white">{data.advanced.searches_today.ai}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                <span className="text-slate-400">Standard Searches</span>
                                <span className="text-xl font-bold text-white">{data.advanced.searches_today.standard}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-slate-400">Roulette Searches</span>
                                <span className="text-xl font-bold text-white">{data.advanced.searches_today.roulette}</span>
                            </div>
                        </div>
                    </div>

                    {/* Subscriptions & Onboarding */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                        <TrendingUp className="w-6 h-6 text-fuchsia-400 mb-4" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">User Milestones & Plans</h3>
                        <div className="flex justify-between items-end border-b border-slate-800 pb-4 mb-4">
                            <span className="text-slate-400">Onboarding Completed</span>
                            <span className="text-2xl font-black text-white">{data.advanced.onboarding_completed}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-800 pb-4 mb-4">
                            <span className="text-slate-400">Avg Profit Per User</span>
                            <span className="text-xl font-bold text-emerald-400">₹{data.advanced.average_profit_per_person_inr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs uppercase tracking-wide block mb-2">Active Plan Distribution</span>
                            {data.advanced.plan_purchases.length === 0 ? (
                                <span className="text-slate-600 text-sm">No active subscriptions yet.</span>
                            ) : (
                                data.advanced.plan_purchases.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center mt-1">
                                        <span className="text-slate-400 text-sm">{p.plan__name}</span>
                                        <span className="text-white font-bold text-sm">{p.count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Financial Projections */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 text-emerald-500/10 pointer-events-none">
                        <IndianRupee className="w-64 h-64" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <IndianRupee className="w-6 h-6 text-emerald-400" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500">Financial Tracker</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <p className="text-slate-400 text-sm mb-2">Total Gross Revenue</p>
                            <p className="text-4xl font-black text-white">₹{data.financials.total_revenue_inr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm mb-2">Projected AI Costs</p>
                            <p className="text-4xl font-black text-rose-400">${data.financials.projected_api_cost_usd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:4})}</p>
                            <p className="text-xs text-slate-500 mt-1">Based on LLM quota burns</p>
                        </div>
                        <div className="pl-6 border-l border-slate-800">
                            <p className="text-slate-400 text-sm mb-2">Estimated Net Profit</p>
                            <p className={`text-4xl font-black ${data.financials.estimated_profit_inr >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                ₹{data.financials.estimated_profit_inr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
