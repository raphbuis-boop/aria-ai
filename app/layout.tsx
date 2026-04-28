import type { Metadata } from "next";
import { ComplianceFooter } from "@/components/ComplianceFooter";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Aria",
  description: "Your AI real estate teammate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.className} min-h-screen bg-[#0a0a0f] text-[#f0eee8]`}>
        <ToastProvider>
          {children}
          <ComplianceFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
