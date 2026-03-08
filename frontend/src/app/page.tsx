"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldAlert, Zap, Search, Brain, Network } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 8); // 8 is length of "GLYSMORK"
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-contain bg-center bg-no-repeat bg-black text-white"
      style={{ backgroundImage: `url('/glysmork_signup.png')` }}
    >
      {/* Background Overlay for text readability if needed */}
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10 max-w-4xl pt-20"
      >
        <div className="mb-6 h-20 flex items-end justify-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-[0.2em] flex justify-center gap-1 md:gap-2">
            {['G', 'L', 'Y', 'S', 'M', 'O', 'R', 'K'].map((letter, index) => (
              <span
                key={index}
                className={`transition-all duration-300 inline-block bg-clip-text text-transparent ${index === activeIndex
                  ? 'bg-gradient-to-r from-cyan-300 via-green-400 to-purple-500 text-6xl md:text-7xl -translate-y-3 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                  : 'bg-gradient-to-r from-cyan-800 via-green-800 to-purple-800 opacity-80'
                  }`}
              >
                {letter}
              </span>
            ))}
          </h1>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 px-6 py-2 rounded-full bg-black/40 backdrop-blur-md text-sm text-purple-300 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="tracking-wide">The Universal Connection Engine</span>
        </motion.div>

        <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-gray-400 drop-shadow-sm">
          Find Exactly<br />Who You Need.
        </h2>

        <p className="text-lg md:text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed drop-shadow-md">
          Describe the kind of person you want to talk to — a topic, a mindset, a vibe, an expertise. Our AI analyzes everyone deeply, then connects you to the exact right human. Any purpose. Any conversation. Precise.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link href="/onboarding">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(219,39,119,0.5)] border border-pink-400/50"
            >
              Start The Analysis
              <Zap className="w-5 h-5 ml-2" />
            </motion.button>
          </Link>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-4 rounded-full bg-black/50 backdrop-blur-md text-gray-200 font-bold hover:bg-white/10 hover:text-white transition-colors border border-white/20 shadow-lg"
            >
              Login
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full z-10 pb-20"
      >
        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:-translate-y-2 transition-transform duration-300 shadow-xl">
          <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Search className="w-7 h-7 text-cyan-400" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">Intent-Driven Matching</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Tell us what you need — a startup co-founder, someone who understands grief, a quantum physics nerd, or just a chill person to vent to. We find them.</p>
        </div>

        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:-translate-y-2 transition-transform duration-300 shadow-xl">
          <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
            <Brain className="w-7 h-7 text-green-400" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">Deep Profile Analysis</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Every user is profoundly analyzed — psychology, interests, expertise, conversation patterns. The AI knows them better than they know themselves.</p>
        </div>

        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:-translate-y-2 transition-transform duration-300 shadow-xl">
          <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Network className="w-7 h-7 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-white">The Right Connection</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Not random. Not algorithmic swipes. You describe who you need, and the system delivers exactly that person from the network.</p>
        </div>
      </motion.div>
    </main>
  );
}
