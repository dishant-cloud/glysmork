import type { Metadata } from "next";
import { Outfit, Inter, Dancing_Script } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Glysmork — Find Exactly Who You Need",
  description: "The Universal Connection Engine. Describe the person you need, and our AI finds them from the community. Not dating. Not random. Precise.",
};

import { ThemeProvider } from "@/components/ThemeProvider";
import NotificationProvider from "@/components/NotificationProvider";
import CallProvider from "@/components/CallProvider";
import IncomingCallUI from "@/components/IncomingCallUI";
import ActiveCallUI from "@/components/ActiveCallUI";
import RouteChangeDispatcher from "@/components/RouteChangeDispatcher";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${inter.variable} ${dancingScript.variable} antialiased`}
        style={{ backgroundColor: '#FFFFFF', overflowX: 'hidden' }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NotificationProvider>
            <RouteChangeDispatcher />
            <CallProvider>
              <div className="flex flex-col min-h-screen">
                <main className="flex-1 flex flex-col">
                  {children}
                </main>
                <footer className="w-full py-4 px-6 text-center text-[12px] font-semibold bg-white border-t border-slate-200 flex justify-center gap-6 mt-auto shrink-0 relative z-40">
                  <a href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-black transition-colors">Privacy Policy</a>
                  <a href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-black transition-colors">Terms of Service</a>
                  <span className="text-slate-400">© {new Date().getFullYear()} Glysmork</span>
                </footer>
              </div>
              <IncomingCallUI />
              <ActiveCallUI />
            </CallProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
