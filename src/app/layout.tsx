import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pulse — Fitness Tracker",
  description:
    "Track workouts, crush goals, and monitor progress. AI-powered fitness app with offline-first design.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inline blocking script: reads the persisted theme from localStorage and
  // sets data-theme BEFORE first paint. Without this, dark-mode users see a
  // white flash on every load because the SSR HTML defaults to light mode and
  // the theme is only applied in a useEffect after hydration.
  const themeScript = `(function(){try{var s=localStorage.getItem("pulse-settings");if(s){var t=JSON.parse(s).state?.theme;if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");return}if(t==="light"){document.documentElement.setAttribute("data-theme","light");return}}var m=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",m?"dark":"light")}catch(e){}})()`;

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
