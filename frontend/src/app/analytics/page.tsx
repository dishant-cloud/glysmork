"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { Activity, Users, Globe, PieChart, TrendingUp, Cpu, Server, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';

interface AnalyticsData {
    total_nodes: number;
    active_nodes: number;
    gender_distribution: Record<string, number>;
    top_locations: Record<string, number>;
    growth_trends: { date: string; joins: number }[];
    system_status: string;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        <main className="min-h-screen bg-[#050511] text-white relative overflow-hidden font-mono">
            {/* Background elements consistent with theme */}
            <div className="bg-noise opacity-5" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />

            <Header />

            <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
                {/* Back button and breadcrumbs */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 border border-white/10 hover:bg-white/5 transition-colors group">
                        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                    </Link>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-cyan-500/70 tracking-widest uppercase">Network Diagnostics</span>
                        <h1 className="text-3xl font-black tracking-tighter uppercase italic">System Analytics</h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <div className="w-12 h-12 border-2 border-t-cyan-500 border-r-purple-500 border-b-cyan-500 border-l-transparent animate-spin rounded-full mb-4" />
                        <span className="text-xs text-slate-500 animate-pulse uppercase tracking-widest">Compiling Neural Data...</span>
                    </div>
                ) : data && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Summary Stats */}
                        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                            <MetricCard 
                                icon={<Users className="w-5 h-5" />} 
                                label="Total Neural Nodes" 
                                value={data.total_nodes} 
                                color="cyan"
                            />
                            <MetricCard 
                                icon={<Activity className="w-5 h-5" />} 
                                label="Active Connections" 
                                value={data.active_nodes} 
                                color="green"
                            />
                            <MetricCard 
                                icon={<Server className="w-5 h-5" />} 
                                label="System Status" 
                                value={data.system_status} 
                                color="white"
                                subValue="LATENCY: 24ms"
                            />
                            <MetricCard 
                                icon={<Shield className="w-5 h-5" />} 
                                label="Security Layer" 
                                value="ENCRYPTED" 
                                color="purple"
                                subValue="TRUST CORE ACTIVE"
                            />
                        </div>

                        {/* Growth Chart */}
                        <div className="lg:col-span-8 bg-white/5 border border-white/10 p-8 relative overflow-hidden group">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-cyan-400">
                                    <TrendingUp className="w-4 h-4" /> Join Velocity (Past 7 Days)
                                </h3>
                                <div className="text-[10px] text-slate-500">REALTIME_SYNC_ON</div>
                            </div>
                            
                            <div className="relative h-64 flex items-end gap-3 px-4">
                                {data.growth_trends.map((day, idx) => (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-4 group/bar">
                                        <div className="relative w-full flex flex-col items-center justify-end h-48">
                                            <motion.div 
                                                initial={{ height: 0 }}
                                                animate={{ height: `${(day.joins / maxJoins) * 100}%` }}
                                                className="w-full bg-gradient-to-t from-cyan-600/40 to-cyan-400 border-t border-cyan-300 relative"
                                            >
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-cyan-400 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                                                    +{day.joins} NODES
                                                </div>
                                            </motion.div>
                                        </div>
                                        <span className="text-[9px] text-slate-600 rotate-45 mt-2 origin-left whitespace-nowrap uppercase">{day.date.split('-').slice(1).join('/')}</span>
                                    </div>
                                ))}
                                
                                {/* Grid lines */}
                                <div className="absolute inset-x-0 bottom-0 top-0 border-b border-white/10 flex flex-col justify-between pointer-events-none opacity-20">
                                    <div className="border-t border-white/10 w-full" />
                                    <div className="border-t border-white/10 w-full" />
                                    <div className="border-t border-white/10 w-full" />
                                    <div className="border-t border-white/10 w-full" />
                                </div>
                            </div>
                        </div>

                        {/* Top Locations */}
                        <div className="lg:col-span-4 bg-white/5 border border-white/10 p-8 flex flex-col h-full">
                            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-purple-400 mb-8">
                                <Globe className="w-4 h-4" /> Geospatial Reach
                            </h3>
                            <div className="space-y-6 flex-1">
                                {Object.entries(data.top_locations).map(([country, count], idx) => (
                                    <div key={country} className="space-y-2">
                                        <div className="flex justify-between text-[10px] uppercase font-bold">
                                            <span>{country || "Unknown Node"}</span>
                                            <span className="text-purple-400">{count} NODES</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 relative overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(count / Math.max(...Object.values(data.top_locations))) * 100}%` }}
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(data.top_locations).length === 0 && (
                                    <div className="text-center py-10 opacity-20 italic">No spatial data found</div>
                                )}
                            </div>
                        </div>

                        {/* Gender Diversity */}
                        <div className="lg:col-span-4 bg-white/5 border border-white/10 p-8">
                            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-rose-400 mb-8">
                                <PieChart className="w-4 h-4" /> Gender Matrix
                            </h3>
                            <div className="flex flex-col gap-4">
                                {Object.entries(data.gender_distribution).map(([gender, count]) => (
                                    <div key={gender} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-mono uppercase">Category</span>
                                            <span className="text-sm font-black uppercase tracking-wider">{gender}</span>
                                        </div>
                                        <div className="text-xl font-black text-rose-500/80">
                                            {count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* System Logs */}
                        <div className="lg:col-span-8 bg-white/5 border border-white/10 p-8">
                            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400 mb-8">
                                <Cpu className="w-4 h-4" /> Neural Logs
                            </h3>
                            <div className="space-y-3 font-mono text-[10px]">
                                <div className="text-green-500/80">{"[SUCCESS]"} ALL SYSTEMS OPERATIONAL</div>
                                <div className="text-cyan-500/60">{"[INFO]"} REDIS NODE CLUSTER AT 12% LOAD</div>
                                <div className="text-purple-500/60">{"[INFO]"} AI PAIRING ENGINE SYNCHRONIZED</div>
                                <div className="text-slate-500">{"[LOG]"} HEARTBEAT RECEIVED FROM {data.active_nodes} ACTIVE NODES</div>
                                <div className="text-slate-500">{"[LOG]"} SYSTEM CACHE FLUSHED AT {new Date().toLocaleTimeString()}</div>
                                <div className="text-slate-600 border-t border-white/5 pt-3">{"[BOOT]"} DISTRIBUTED NETWORK INITIALIZED VIA GLYSMORK CORE</div>
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
        cyan: "border-cyan-500/20 text-cyan-400",
        purple: "border-purple-500/20 text-purple-400",
        green: "border-green-500/20 text-green-400",
        rose: "border-rose-500/20 text-rose-400",
        white: "border-white/10 text-white"
    };

    return (
        <div className={`bg-white/5 border ${colorClasses[color]} p-6 group hover:bg-white/10 transition-all`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 bg-white/5 ${colorClasses[color]} border border-current opacity-70`}>
                    {icon}
                </div>
                <div className="text-[10px] opacity-40 font-mono italic">HUB_DATA</div>
            </div>
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">{label}</h4>
            <div className="text-2xl font-black tracking-tighter uppercase">{value}</div>
            {subValue && <div className="text-[9px] mt-2 opacity-50 uppercase tracking-tighter">{subValue}</div>}
        </div>
    );
}
