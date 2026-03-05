"use client";

import { motion } from 'framer-motion';
import { Sparkles, ShieldAlert, Zap, Search, Brain, Network } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden">

      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[100px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[100px] -z-10" />

      {/* Logo Header */}
      <div className="absolute top-6 left-6 z-20">
        <Logo size="lg" />
      </div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10 max-w-4xl"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm text-purple-300 border-purple-500/30"
        >
          <Sparkles className="w-4 h-4" />
          <span>The Universal Connection Engine</span>
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-gray-400">
          Find Exactly<br />Who You Need.
        </h1>

        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Describe the kind of person you want to talk to — a topic, a mindset, a vibe, an expertise. Our AI analyzes everyone deeply, then connects you to the exact right human. Any purpose. Any conversation. Precise.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/onboarding">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 transition-colors shadow-[0_0_30px_rgba(109,40,217,0.4)]"
            >
              Start The Analysis
              <Zap className="w-5 h-5 ml-2" />
            </motion.button>
          </Link>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-xl glass-panel text-white font-semibold hover:bg-white/10 transition-colors"
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
        className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full z-10"
      >
        <div className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-6">
            <Search className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Intent-Driven Matching</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Tell us what you need — a startup co-founder, someone who understands grief, a quantum physics nerd, or just a chill person to vent to. We find them.</p>
        </div>

        <div className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6">
            <Brain className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-3">Deep Profile Analysis</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Every user is profoundly analyzed — psychology, interests, expertise, conversation patterns. The AI knows them better than they know themselves.</p>
        </div>

        <div className="glass-panel p-8 hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 relative z-10">
            <Network className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-3 relative z-10">The Right Connection</h3>
          <p className="text-gray-400 text-sm leading-relaxed relative z-10">Not random. Not algorithmic swipes. You describe who you need, and the system delivers exactly that person from the network.</p>
        </div>
      </motion.div>
    </main>
  );
}
