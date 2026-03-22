import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Longtail",
  description: "Agent-powered P2P prediction market on Base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#1a1a2e] text-gray-200 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
