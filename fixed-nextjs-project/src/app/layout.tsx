import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Cinzel, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cinzel",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jbmono",
});

export const metadata: Metadata = {
  title: "TOSS BOOK 786 - Asia's No. 1 Premium Toss Platform",
  description:
    "Asia's No. 1 premium toss platform. Live toss contests, instant wallet, royal gold experience.",
  icons: [{ rel: "icon", url: "/images/logo.png" }],
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${cinzel.variable} ${manrope.variable} ${jbmono.variable} bg-ink font-sans text-[#eae7db] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
