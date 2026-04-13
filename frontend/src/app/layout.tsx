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
