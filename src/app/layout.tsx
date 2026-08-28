import type { Metadata } from "next";
import { Geist_Mono, Inter, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
    default: "Bedlay Gardens LTD",
    template: "%s | Bedlay Gardens LTD",
  },
  description:
    "Secure countryside dog boarding, daycare, forest walks, and dog walking near Glasgow.",
  openGraph: {
    siteName: "Bedlay Gardens LTD",
    type: "website",
    locale: "en_GB",
    // Sitewide fallback so every page has a share preview image — no route
    // currently overrides `openGraph`, so this covers all of them.
    images: [{ url: "/images/logo.png" }],
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
      className={`${inter.variable} ${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before React
          hydrates, which otherwise trips a false-positive hydration warning
          — see https://nextjs.org/docs/messages/react-hydration-error */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
