import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glysmork — Find Exactly Who You Need",
  description: "The Universal Connection Engine. Describe the person you need, and our AI finds them from the community. Not dating. Not random. Precise.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";
import NotificationProvider from "@/components/NotificationProvider";
import CallProvider from "@/components/CallProvider";
import IncomingCallUI from "@/components/IncomingCallUI";
import ActiveCallUI from "@/components/ActiveCallUI";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${inter.variable} antialiased`}
        style={{ backgroundColor: '#050511', overflowX: 'hidden' }}
      >
        <div id="global-bg-container" className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
          {/* Base Image Layer with Slow Zoom */}
          <div 
            className="absolute inset-0 animate-slow-zoom" 
            style={{ 
              backgroundImage: "url('/glysmork_signup.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed'
            }} 
          />
          
          {/* Atmospheric Orbs Layer */}
          <div className="absolute inset-0 mix-blend-screen opacity-30">
            <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-cyan-500/20 rounded-full blur-[120px] animate-float" />
            <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-5s' }} />
            <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px] animate-pulse-slow" />
          </div>

          {/* Grainy Noise Texture Layer */}
          <div className="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay" />

          {/* Dynamic Dark Gradient / Vignette Layer */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(5, 5, 17, 0.4) 0%, rgba(5, 5, 17, 0.8) 70%, rgba(5, 5, 17, 1) 100%)'
            }}
          />
        </div>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NotificationProvider>
            <CallProvider>
              {children}
              <IncomingCallUI />
              <ActiveCallUI />
            </CallProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
