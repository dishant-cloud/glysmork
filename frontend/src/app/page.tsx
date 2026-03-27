"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Search, Brain, Network, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import Header from '@/components/Header';

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('user')) {
      setIsLoggedIn(true);
      window.location.href = '/dashboard';
      return;
    }
  }, []);


  return (
    <main className="min-h-screen relative bg-transparent text-slate-900 dark:text-white selection:bg-cyan-500/30 overflow-hidden transition-colors duration-300">

      {/* Texture Layer */}
      <div className="bg-noise dark:opacity-5 opacity-20" />


      {/* Shared Header */}
      <Header />

      {/* Marquee Banner */}
      <div className="absolute top-32 w-[200%] -left-[50%] -rotate-2 overflow-hidden bg-purple-100/50 dark:bg-purple-900/10 border-y border-purple-200 dark:border-purple-500/20 py-3 z-0 flex pointer-events-none transition-colors">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="text-xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-600 mx-8 uppercase">
              • Universal Connection Engine • No Cap • Pure Intent
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto min-h-screen flex flex-col justify-center px-6 md:px-12 pt-40 pb-20 pointer-events-none">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center pointer-events-auto">

          {/* Left Col: Massive Typography & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start mt-12 md:mt-0">

            {/* The Animated Logo integrated as a pre-title */}
            <div className="mb-8 flex items-end">
              <h1 className="text-3xl md:text-4xl font-black tracking-[0.25em] flex gap-1">
                {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((letter, index) => (
                  <span
                    key={index}
                    className={`transition-all duration-300 inline-block bg-clip-text text-transparent ${index === activeIndex
                      ? 'bg-gradient-to-r from-cyan-400 via-green-500 to-purple-600 dark:from-cyan-300 dark:via-green-400 dark:to-purple-500 -translate-y-2 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] dark:drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                      : 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-gray-500 dark:to-gray-400'
                      }`}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
            </div>

            <h2 className="text-6xl md:text-8xl lg:text-[110px] leading-[0.85] font-black tracking-tighter mb-10 text-slate-900 dark:text-white uppercase mix-blend-normal dark:mix-blend-difference transition-colors">
              Find<br />Exactly<br />Who You<br />Need.
            </h2>

            <p className="text-lg md:text-xl text-slate-600 dark:text-gray-400 max-w-lg mb-12 leading-relaxed border-l-3 border-purple-500/50 pl-6 transition-colors">
              Not another algorithm. Not a dating app.<br />Describe a topic, a mindset, or an expertise. Our smart engine connects you to the exact person you need.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full sm:w-auto px-10 py-5 rounded-none bg-cyan-500 text-black font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-[8px_8px_0px_rgba(34,211,238,0.5)] border border-cyan-400 hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_rgba(34,211,238,0.5)]"
                    >
                      Return to Hub
                      <ArrowUpRight className="w-6 h-6" />
                    </motion.button>
                  </Link>
                  <button onClick={() => alert("Discover phase loading...")} className="w-full sm:w-auto px-10 py-5 rounded-none bg-transparent text-slate-800 dark:text-white font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all border border-slate-300 dark:border-white/30 hover:bg-white/5">
                    Discover Users
                  </button>
                </>
              ) : (
                <>
                  <Link href="/signup" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold flex items-center justify-center gap-4 transition-all shadow-[0_10px_30px_rgba(168,85,247,0.3)] border border-black dark:border-white hover:y-[-2px]"
                    >
                      Get Started
                      <ArrowUpRight className="w-6 h-6" />
                    </motion.button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-transparent text-slate-800 dark:text-white font-bold flex items-center justify-center gap-4 transition-all border border-slate-300 dark:border-white/20 hover:bg-white/5"
                    >
                      Sign In
                    </motion.button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Col: Asymmetrical Floating Cards */}
          <div className="lg:col-span-5 relative mt-20 lg:mt-0 h-[600px] w-full hidden md:block border-slate-200">

            {/* Card 1 */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute top-10 right-0 w-72 bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-black/10 dark:border-white/20 p-8 rounded-3xl z-20 shadow-2xl transition-colors"
            >
              <div className="flex justify-between items-start mb-12">
                <Search className="text-cyan-600 dark:text-cyan-400 w-6 h-6 transition-colors" />
                <span className="text-xs font-bold text-slate-400 dark:text-gray-500 transition-colors">01</span>
              </div>
              <h3 className="text-xl font-bold mb-2 tracking-tight text-slate-800 dark:text-white transition-colors">Intent Search</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 font-medium transition-colors">Specify who you need. The engine searches the network.</p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-64 left-0 lg:-left-12 w-80 bg-purple-100/60 dark:bg-purple-900/30 backdrop-blur-xl border border-purple-300/40 dark:border-purple-500/40 p-8 rounded-3xl z-30 shadow-2xl transition-colors"
            >
              <div className="flex justify-between items-start mb-12">
                <Brain className="text-purple-600 dark:text-purple-400 w-6 h-6 transition-colors" />
                <span className="text-xs font-bold text-purple-400 dark:text-purple-300 transition-colors">02</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-purple-900 dark:text-purple-100 tracking-tight transition-colors">Smart Matching</h3>
              <p className="text-sm text-purple-700/80 dark:text-purple-200/70 font-medium leading-relaxed transition-colors">Every profile analyzed for pure conceptual compatibility and personality resonance.</p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute bottom-10 right-10 w-64 bg-slate-50/80 dark:bg-black/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-3xl z-10 shadow-xl transition-colors"
            >
              <div className="flex justify-between items-start mb-8">
                <Network className="text-slate-500 dark:text-gray-500 w-6 h-6 transition-colors" />
                <span className="text-xs font-bold text-slate-400 dark:text-gray-600 transition-colors">03</span>
              </div>
              <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-gray-300 transition-colors">Direct Connection</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500 font-medium transition-colors">Instant routing to the right person.</p>
            </motion.div>

          </div>
        </div>
      </div>
    </main>
  );
}
