"use client";

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';
import { ShieldAlert, ArrowLeft, Ban, AlertTriangle, Eye, CheckCircle, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface Report {
    id: number;
    reporter: string;
    reported_user: string;
    reason: string;
    timestamp: string;
    status: string;
}

interface ChatMessage {
    sender: string;
    text: string;
    timestamp: string;
}

export default function ModerationQueue() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [chatContext, setChatContext] = useState<ChatMessage[] | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await fetchApi('/users/admin/moderation/reports/');
                setReports(res);
            } catch (err: any) {
                console.error("Moderation Error", err);
                setError(err.message || "Failed to load reports. Ensure you have admin privileges.");
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    const fetchContext = async (reportId: number) => {
        setLoadingContext(true);
        setChatContext(null);
        try {
            const res = await fetchApi(`/users/admin/moderation/reports/${reportId}/context/`);
            setChatContext(res.messages || []);
        } catch (err: any) {
            console.error("Context Error", err);
        } finally {
            setLoadingContext(false);
        }
    };

    const handleBanUser = async (username: string, reportId: number) => {
        if (!confirm(`Are you sure you want to toggle the ban status for ${username}?`)) return;
        try {
            await fetchApi('/users/admin/moderation/ban/', {
                method: 'POST',
                body: JSON.stringify({ username }),
            });
            // Remove report from list if it's actioned
            setReports(prev => prev.filter(r => r.id !== reportId));
            setSelectedReport(null);
        } catch (err: any) {
            alert(err.message || "Failed to ban user");
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white"><div className="animate-spin w-10 h-10 border-4 border-slate-700 border-t-rose-500 rounded-full" /></div>;

    if (error) return (
        <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-6 text-center">
            <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-slate-400 max-w-md">{error}</p>
            <Link href="/admin/dashboard" className="mt-6 px-6 py-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">Return to Dashboard</Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-rose-500/30">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            <ShieldAlert className="w-8 h-8 text-rose-500" /> Moderation Queue
                        </h1>
                        <p className="text-slate-500 mt-1">Review active user reports and enforce community guidelines.</p>
                    </div>
                    <Link href="/admin/dashboard" className="p-2 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </Link>
                </header>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Active Reports List */}
                    <div className="lg:w-1/3 flex flex-col gap-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Pending Reports ({reports.length})</h2>
                        {reports.length === 0 ? (
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center flex flex-col items-center">
                                <CheckCircle className="w-10 h-10 text-emerald-500 mb-3 opacity-50" />
                                <p className="text-slate-400 font-medium">No pending reports.</p>
                                <p className="text-slate-500 text-sm">Community is peaceful.</p>
                            </div>
                        ) : (
                            reports.map(report => (
                                <div 
                                    key={report.id} 
                                    onClick={() => {
                                        setSelectedReport(report);
                                        fetchContext(report.id);
                                    }}
                                    className={`bg-slate-900 border ${selectedReport?.id === report.id ? 'border-rose-500/50 ring-1 ring-rose-500/50' : 'border-slate-800 hover:border-slate-700'} p-5 rounded-2xl cursor-pointer transition-all relative`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                                            <span className="font-bold text-white text-lg">{report.reported_user}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{new Date(report.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-3"><strong className="text-slate-300">Reporter:</strong> {report.reporter}</p>
                                    <p className="text-sm text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                        "{report.reason}"
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Report Context & Action Panel */}
                    <div className="lg:w-2/3">
                        {selectedReport ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[700px]">
                                {/* Header */}
                                <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-1">Reviewing: {selectedReport.reported_user}</h2>
                                        <p className="text-sm text-slate-400 flex items-center gap-2"><Eye className="w-4 h-4"/> Chat context with {selectedReport.reporter}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleBanUser(selectedReport.reported_user, selectedReport.id)}
                                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 transition-colors shadow-lg shadow-rose-500/20"
                                    >
                                        <Ban className="w-4 h-4" /> Ban User
                                    </button>
                                </div>

                                {/* Chat Context Log */}
                                <div className="flex-1 overflow-y-auto p-6 bg-[#0B1120]">
                                    {loadingContext ? (
                                        <div className="flex justify-center py-10 opacity-40"><div className="w-6 h-6 border-2 border-t-rose-500 rounded-full animate-spin" /></div>
                                    ) : chatContext && chatContext.length > 0 ? (
                                        <div className="space-y-4">
                                            {chatContext.map((msg, idx) => {
                                                const isReporter = msg.sender === selectedReport.reporter;
                                                return (
                                                    <div key={idx} className={`flex flex-col ${isReporter ? 'items-start' : 'items-end'}`}>
                                                        <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isReporter ? 'text-slate-500' : 'text-rose-400'}`}>
                                                            {msg.sender}
                                                        </span>
                                                        <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isReporter ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 'bg-slate-700 border border-slate-600 text-white rounded-tr-none'}`}>
                                                            {msg.text}
                                                        </div>
                                                        <span className="text-[10px] text-slate-600 mt-1">{new Date(msg.timestamp).toLocaleString()}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                            <MessageSquare className="w-12 h-12 text-slate-600 mb-4" />
                                            <p className="text-slate-400">No chat history found between these users.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-[700px] border-2 border-dashed border-slate-800 rounded-3xl flex items-center justify-center">
                                <p className="text-slate-500 font-medium flex items-center gap-2">
                                    <ArrowLeft className="w-5 h-5" /> Select a report to review context
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
