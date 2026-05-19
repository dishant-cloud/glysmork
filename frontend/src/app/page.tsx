"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Brain, Network, ArrowUpRight, ArrowRight, Star, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('user')) {
      setIsLoggedIn(true);
      window.location.href = '/dashboard';
      return;
    }
  }, []);

  // Subtle floating animation for cards
  const floatingAnimate = { y: ["-5px", "10px", "-5px"] };
  const floatingTransition = { duration: 6, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <main className="min-h-screen w-full font-sans text-slate-900 bg-gradient-to-br from-[#dcedec] via-[#f5f3ed] to-[#fadac0] overflow-hidden relative selection:bg-cyan-500/30">
      
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-[10%] right-[-5%] w-[800px] h-[800px] bg-white/70 blur-[150px] rounded-full mix-blend-overlay pointer-events-none" />
      <div className="absolute bottom-[20%] left-[30%] w-[600px] h-[600px] bg-orange-100/30 blur-[130px] rounded-full mix-blend-overlay pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] bg-cyan-200/20 blur-[100px] rounded-full mix-blend-overlay pointer-events-none" />

      {/* Navbar */}
      <nav className="flex justify-between items-center px-4 md:px-12 py-6 md:py-8 relative z-20 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2 text-[22px] md:text-[26px] font-bold tracking-tight text-slate-800">
          Glysmork
          <Network className="w-5 h-5 md:w-6 md:h-6 text-slate-500" />
        </div>
        
        <ul className="hidden md:flex gap-10 text-[15px] font-medium text-slate-600">
          <li><Link href="/login" className="hover:text-black transition-colors">Sign In</Link></li>
          <li><Link href="/signup" className="hover:text-black transition-colors">Get Started</Link></li>
        </ul>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-[14px] font-semibold text-slate-700 hover:text-black transition-colors px-4 py-2">
            Sign In
          </Link>
          <Link href="/signup" className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-800 text-white text-[14px] font-semibold hover:bg-slate-900 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
            Get Started
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Buttons & Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/login" className="text-[13px] font-semibold text-slate-700 hover:text-black">
            Sign In
          </Link>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-800 ml-2"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-3xl border-b border-slate-200 shadow-xl md:hidden flex flex-col px-6 py-6 z-50"
          >
            <Link href="/connections" className="py-3 text-[16px] font-semibold text-slate-700 border-b border-slate-100">Connections</Link>
            <Link href="/help" className="py-3 text-[16px] font-semibold text-slate-700 border-b border-slate-100">Help</Link>
            <Link href="/premium" className="py-3 text-[16px] font-semibold text-slate-700 border-b border-slate-100">Pricing</Link>
            <Link href="/events" className="py-3 text-[16px] font-semibold text-slate-700 mb-2">Events</Link>
            <Link href="/signup" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full bg-slate-900 text-white text-[15px] font-semibold hover:bg-slate-800 transition-all shadow-md">
              Get Started <ArrowUpRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-12 pt-8 md:pt-16 pb-16 md:pb-24 items-center min-h-[calc(100vh-100px)]">
        
        {/* Left Col: Main Text & CTA */}
        <div className="lg:col-span-6 flex flex-col items-start xl:pl-8 relative z-20">
          
          <div className="flex gap-1.5 mb-6 opacity-90 drop-shadow-sm">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-amber-500 fill-amber-500 opacity-90" />
            ))}
          </div>
          
          <h1 className="text-[48px] sm:text-[64px] md:text-[90px] leading-[1.05] md:leading-[0.95] font-semibold tracking-[-0.03em] text-slate-900 mb-6 md:mb-8 drop-shadow-sm">
            Find Exactly<br />Who You<br />Need.
          </h1>

          <p className="text-[16px] sm:text-[18px] text-slate-600 mb-8 md:mb-10 max-w-[480px] leading-relaxed font-medium">
            Not another algorithm. Describe a topic, a mindset, or an expertise. Our smart engine connects you to the exact person you need to scale your growth instantly.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto mb-14">
            <Link href="/signup" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-9 py-4 rounded-full bg-slate-900 text-white text-[16px] font-semibold flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(15,23,42,0.15)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.25)] hover:-translate-y-1">
                Join Network 
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-9 py-4 rounded-full bg-white/50 backdrop-blur-md text-slate-800 text-[16px] font-semibold flex items-center justify-center transition-all border border-white/60 shadow-sm hover:bg-white/80 hover:shadow-md hover:-translate-y-1">
                Learn More
              </button>
            </Link>
          </div>

          {/* Connected Social Proof Line */}
          <div className="flex items-center gap-3 sm:gap-4 bg-white/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/60 shadow-sm w-full max-w-max mx-auto sm:mx-0">
            <div className="flex -space-x-3 shrink-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-100 bg-slate-200 overflow-hidden relative z-10 transition-transform hover:z-20 hover:scale-110 object-cover">
                  <img src={`https://i.pravatar.cc/100?img=${i + 22}`} className="w-full h-full object-cover" alt="User" />
                </div>
              ))}
            </div>
            <span className="text-[12px] sm:text-[14px] font-medium text-slate-700 pr-2 whitespace-nowrap">
              Joined by <strong className="text-slate-900 font-bold">25k+</strong> pros
            </span>
          </div>
        </div>

        {/* Right Col: Layered "Cluster" of Feature Cards */}
        <div className="lg:col-span-6 relative w-full h-[450px] sm:h-[500px] lg:h-full lg:min-h-[600px] flex justify-center items-center mt-12 lg:mt-0 xl:mr-10 scale-[0.8] sm:scale-[0.9] lg:scale-100">
          
          {/* Main Central Card (Smart Matching) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1, ...floatingAnimate }} 
            transition={{ delay: 0.2, ...floatingTransition }}
            className="absolute z-10 w-[90%] sm:w-[360px] bg-white/80 backdrop-blur-2xl border border-white p-6 sm:p-8 rounded-[36px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)]"
          >
            <div className="bg-slate-50/80 rounded-[24px] p-6 mb-6 sm:mb-8 w-full flex justify-center items-center shadow-inner relative overflow-hidden h-[120px] sm:h-[160px] border border-slate-100/50">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50" />
              <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-[20px] shadow-sm flex items-center justify-center border border-slate-100">
                 <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
              </div>
            </div>
            <h3 className="text-[22px] sm:text-[26px] font-semibold mb-2 sm:mb-3 text-slate-800 tracking-[-0.03em]">Smart Matching</h3>
            <p className="text-[14px] sm:text-[15px] text-slate-500 font-medium leading-relaxed">
              Every profile is analyzed for pure conceptual compatibility and personality resonance.
            </p>
          </motion.div>

          {/* Top Left Overlapping Card (Intent Search) */}
          <motion.div 
            initial={{ opacity: 0, x: -30, y: -30 }} 
            animate={{ opacity: 1, x: 0, ...floatingAnimate }} 
            transition={{ delay: 0.4, ...floatingTransition }}
            className="absolute z-20 top-[0%] sm:top-[8%] left-[0%] xl:left-[-10%] w-[80%] sm:w-[280px] bg-[#fdfdfc]/90 backdrop-blur-xl border border-white/80 p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]"
          >
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100">
                <Search className="text-cyan-500 w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400">01</span>
            </div>
            <h3 className="text-[14px] sm:text-[16px] font-semibold mb-1 text-slate-800 tracking-tight">Intent Search</h3>
            <p className="text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed">Specify exactly who you need to meet instantly.</p>
          </motion.div>

          {/* Bottom Right Overlapping Card (Direct Connection) */}
          <motion.div 
            initial={{ opacity: 0, x: 30, y: 30 }} 
            animate={{ opacity: 1, x: 0, ...floatingAnimate }} 
            transition={{ delay: 0.6, ...floatingTransition }}
            className="absolute z-20 bottom-[0%] sm:bottom-[8%] right-[0%] xl:right-[-12%] w-[85%] sm:w-[300px] bg-white/90 backdrop-blur-xl border border-white/80 p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] shadow-[0_25px_50px_-15px_rgba(0,0,0,0.1)]"
          >
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
                <Network className="text-orange-500 w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-400">03</span>
            </div>
            <h3 className="text-[14px] sm:text-[16px] font-semibold mb-1 text-slate-800 tracking-tight">Direct Connection</h3>
            <p className="text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed">Get instantly routed, bypassing all the noise.</p>
          </motion.div>

        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-20 max-w-[1600px] mx-auto px-4 md:px-12 py-8 flex flex-col sm:flex-row justify-between items-center border-t border-slate-200/50 text-slate-500 text-[13px] font-medium mt-auto">
        <div className="mb-4 sm:mb-0">© {new Date().getFullYear()} Glysmork. All rights reserved.</div>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </main>
  );
}
