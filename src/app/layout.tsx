import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Bedlay Gardens Kennels",
    template: "%s | Bedlay Gardens Kennels",
  },
  description:
    "Secure countryside dog boarding, daycare, forest walks, and dog walking near Glasgow.",
  openGraph: {
    siteName: "Bedlay Gardens Kennels",
    type: "website",
    locale: "en_GB",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-1 right-1 z-50 select-none rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/70"
        >
          v{commitSha}
        </div>
      </body>
    </html>
  );
}
