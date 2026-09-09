import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getEntries } from "./data";
import { PlayerProvider } from "./player-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Room 205 / Audio",
  description: "Unforgettable melodies from the 90s and beyond.",
  openGraph: {
    title: "Room 205 / Audio",
    description: "Unforgettable melodies from the 90s and beyond.",
    images: [{ url: "/rr99la.png", width: 1536, height: 1024, alt: "Room 205 / Audio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Room 205 / Audio",
    description: "Unforgettable melodies from the 90s and beyond.",
    images: ["/rr99la.png"],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { mujra, nineties } = await getEntries();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col bg-paper font-sans text-ink">
        <PlayerProvider mujra={mujra} nineties={nineties}>
          {children}
        </PlayerProvider>
      </body>
    </html>
  );
}
