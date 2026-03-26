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
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
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
