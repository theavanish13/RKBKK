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
  title: "Saraswati Band",
  description: "Unforgettable melodies from the 90s and beyond.",
  openGraph: {
    title: "Saraswati Band",
    description: "Unforgettable melodies from the 90s and beyond.",
    images: [{ url: "/SB.png", width: 1536, height: 1024, alt: "Saraswati Band" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Saraswati Band",
    description: "Unforgettable melodies from the 90s and beyond.",
    images: ["/SB.png"],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { mujra, nineties, defaultEntry } = await getEntries();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col bg-paper font-sans text-ink">
        <PlayerProvider mujra={mujra} nineties={nineties} defaultEntry={defaultEntry}>
          {children}
        </PlayerProvider>
      </body>
    </html>
  );
}
