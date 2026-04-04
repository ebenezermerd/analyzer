import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Issue Finder — Discover Perfect GitHub Issues",
  description: "AI-powered GitHub issue discovery for PR Writer HFI projects. Smart filtering, real-time streaming, and intelligent scoring.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Issue Finder",
    description: "Discover high-quality GitHub issues matching PR Writer criteria",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${dmSans.variable} ${cormorant.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full flex flex-col noise">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
