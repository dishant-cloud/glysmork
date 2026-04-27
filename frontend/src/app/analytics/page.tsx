"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { Activity, Users, Globe, PieChart, TrendingUp, Cpu, ArrowLeft, Brain } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Header from '@/components/Header';

interface AnalyticsData {
    total_users: number;
    active_users: number;
    gender_distribution: Record<string, number>;
    top_locations: Record<string, number>;
    growth_trends: { date: string; joins: number }[];
    top_interests: Record<string, number>;
    top_expertise: Record<string, number>;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!localStorage.getItem('user')) {
            window.location.href = '/login';
            return;
        }
        const fetchAnalytics = async () => {
            try {
                const res = await fetchApi('/users/analytics/');
                setData(res);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxJoins = data ? Math.max(...data.growth_trends.map(t => t.joins), 1) : 1;

    return (
        <main className="min-h-screen relative bg-gradient-to-br from-[#dcedec] via-[#f3f0e8] to-[#fadac0] text-slate-900 overflow-hidden font-sans">
            {/* Sophisticated Ambient Glows */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
                <div className="absolute top-[5%] right-[5%] w-[600px] h-[600px] bg-white/60 blur-[120px] rounded-full mix-blend-overlay" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50/50 blur-[100px] rounded-full mix-blend-multiply" />
            </div>

            <Header />

            <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
                {/* Header Section */}
                <div className="flex items-center gap-6 mb-12">
                    <Link href="/dashboard" className="p-3 bg-white border border-slate-200/60 rounded-full shadow-sm hover:bg-slate-50 transition-all group">
                        <ArrowLeft className="w-5 h-5 text-slate-600 transition-transform group-hover:-translate-x-1" />
                    </Link>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase mb-1">Live Platform Metrics</span>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Growth & Network Activity</h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <div className="w-12 h-12 border-2 border-t-cyan-500 border-r-purple-500 border-b-cyan-500 border-l-transparent animate-spin rounded-full mb-4" />
                        <span className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">Accessing Neural Logs...</span>
                    </div>
                ) : data && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Summary Stats */}
                        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <MetricCard 
                                icon={<Users className="w-5 h-5" />} 
                                label="Total Users" 
                                value={data.total_users} 
                                color="cyan"
                                subValue="NODE_COUNT_TOTAL"
                            />
                            <MetricCard 
                                icon={<Activity className="w-5 h-5" />} 
                                label="Active Now" 
                                value={data.active_users} 
                                color="green"
                                subValue="LIVE_SIGNALS_DETECTED"
                            />
                        </div>

                        {/* Growth Chart */}
                        <div className="lg:col-span-8 bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] relative overflow-hidden">
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <TrendingUp className="w-4 h-4 text-sky-400" /> Join Velocity (7 Days)
                                </h3>
                                <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2 py-0.5 border border-slate-100 rounded-full">Realtime</div>
                            </div>
                            
                            <div className="relative h-64 flex items-end gap-3 px-4">
                                {data.growth_trends.map((day) => (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-4 group/bar">
                                        <div className="relative w-full flex flex-col items-center justify-end h-48">
                                            <motion.div 
                                                initial={{ height: 0 }}
                                                animate={{ height: `${(day.joins / maxJoins) * 100}%` }}
                                                className="w-full bg-slate-900 rounded-t-lg relative"
                                            >
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-900 opacity-0 group-hover/bar:opacity-100 transition-all bg-white shadow-sm border border-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    +{day.joins}
                                                </div>
                                            </motion.div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{day.date.split('-').slice(2).join('/')}</span>
                                    </div>
                                ))}
                                
                                {/* Background Grid Lines */}
                                <div className="absolute inset-x-0 bottom-0 top-0 border-b border-slate-100 flex flex-col justify-between pointer-events-none opacity-50 -z-10">
                                    <div className="border-t border-slate-100 w-full" />
                                    <div className="border-t border-slate-100 w-full" />
                                    <div className="border-t border-slate-100 w-full" />
                                    <div className="border-t border-slate-100 w-full" />
                                </div>
                            </div>
                        </div>

                        {/* Top Locations */}
                        <div className="lg:col-span-4 bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] flex flex-col justify-between">
                            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
                                <Globe className="w-4 h-4 text-purple-400" /> Regional Reach
                            </h3>
                            <div className="space-y-6 flex-1 h-full">
                                {Object.entries(data.top_locations).map(([country, count]) => (
                                    <div key={country} className="space-y-2">
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-600">
                                            <span>{country || "Unknown Region"}</span>
                                            <span className="text-purple-500">{count}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(count / Math.max(...Object.values(data.top_locations))) * 100}%` }}
                                                className="h-full bg-purple-500 rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(data.top_locations).length === 0 && (
                                    <div className="text-center py-10 text-slate-300 italic text-[10px] uppercase font-bold">No regional data</div>
                                )}
                            </div>
                        </div>

                        {/* Gender Diversity */}
                        <div className="lg:col-span-4 bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">
                            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
                                <PieChart className="w-4 h-4 text-rose-400" /> network demographics
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {['Male', 'Female', 'Other'].map(gender => (
                                    <div key={gender} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group hover:bg-slate-100 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Identity</span>
                                            <span className="text-sm font-black uppercase text-slate-800 tracking-tight">{gender}</span>
                                        </div>
                                        <div className="text-2xl font-black text-slate-900">
                                            {data.gender_distribution[gender] || 0}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Interests & Expertise */}
                        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
                                    <Brain className="w-4 h-4 text-sky-400" /> Hot Interests
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(data.top_interests).map(([interest, count]) => (
                                        <div key={interest} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                                            <span className="text-[11px] font-black uppercase tracking-tight text-slate-700">{interest}</span>
                                            <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded-lg shadow-sm border border-slate-50">{count}</span>
                                        </div>
                                    ))}
                                    {Object.keys(data.top_interests).length === 0 && (
                                        <div className="w-full text-center py-10 text-slate-300 italic text-[10px] uppercase tracking-widest font-bold">No community interest data</div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]">
                                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
                                    <Cpu className="w-4 h-4 text-purple-400" /> Core Expertise
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(data.top_expertise).map(([exp, count]) => (
                                        <div key={exp} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                                            <span className="text-[11px] font-black uppercase tracking-tight text-slate-700">{exp}</span>
                                            <span className="text-[10px] font-bold text-purple-400/70 bg-white px-1.5 py-0.5 rounded-lg shadow-sm border border-slate-50">{count}</span>
                                        </div>
                                    ))}
                                    {Object.keys(data.top_expertise).length === 0 && (
                                        <div className="w-full text-center py-10 text-slate-300 italic text-[10px] uppercase tracking-widest font-bold">No expertise data found</div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </main>
    );
}

function MetricCard({ icon, label, value, color, subValue }: { icon: React.ReactNode, label: string, value: string | number, color: string, subValue?: string }) {
    const colorClasses: Record<string, string> = {
        cyan: "bg-sky-50 text-sky-500 border-sky-100",
        purple: "bg-purple-50 text-purple-500 border-purple-100",
        green: "bg-green-50 text-green-500 border-green-100",
        rose: "bg-rose-50 text-rose-500 border-rose-100",
        white: "bg-slate-50 text-slate-500 border-slate-100"
    };

    return (
        <div className={`bg-white/80 backdrop-blur-2xl border border-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] group hover:-translate-y-1 transition-all duration-300`}>
            <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl border ${colorClasses[color]}`}>
                    {icon}
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Live</div>
            </div>
            <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">{label}</h4>
            <div className="text-4xl font-black text-slate-900 tracking-tighter">{value}</div>
            {subValue && (
                <div className="text-[9px] font-bold mt-4 text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {subValue}
                </div>
            )}
        </div>
    );
}
