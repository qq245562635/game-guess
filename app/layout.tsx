import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no request to Google Fonts at runtime).
import "@fontsource/bungee/400.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameGuess – Daily Video Game Guessing Game",
  description:
    "Guess today's video game in six tries using release year, genre, platform, developer, publisher and perspective clues.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1828" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
