import type { Metadata } from "next";
import { ConditionalComplianceFooter } from "@/components/ConditionalComplianceFooter";
import { SplashScreen } from "@/components/SplashScreen";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { PostHogProvider } from "./providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aria — Every relationship is revenue",
  description:
    "Aria is the AI assistant for NJ real estate agents. It reads your Gmail, drafts replies in your voice, tracks your pipeline, and surfaces every client about to slip.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={instrumentSerif.variable}>
      {/*
        body bg is transparent — the .oc-backdrop div renders the
        Obsidian Chrome canvas. html retains bg-oc-onyx so overscroll
        rubber-band areas stay Onyx on iOS, not white.
      */}
      <body className={`${dmSans.className} min-h-[100dvh] text-oc-alabaster`}>
        {/* Obsidian Chrome backdrop — fixed, z-index -1, behind all content */}
        <div aria-hidden="true" className="oc-backdrop" />
        <SplashScreen />
        <PostHogProvider>
          <ToastProvider>
            {children}
            <ConditionalComplianceFooter />
          </ToastProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
