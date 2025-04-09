import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientOnlyWalletProviders from "@/components/providers/ClientOnlyWalletProviders";
import dynamic from "next/dynamic";

// Import Header with no SSR to avoid hydration issues with wallet components
const Header = dynamic(() => import("@/components/Header"), { ssr: false });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wallet Chat App",
  description: "A Next.js chat application with wallet integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientOnlyWalletProviders>
          <Header />
          {children}
        </ClientOnlyWalletProviders>
      </body>
    </html>
  );
}
