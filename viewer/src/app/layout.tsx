import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Variant Viewer",
  description: "Browse modality comparison experiment variants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}
      >
        <header
          className="px-6 py-3"
          style={{
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-rule)",
          }}
        >
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            variant-viewer
          </Link>
        </header>
        <main className="px-6 py-5">{children}</main>
      </body>
    </html>
  );
}
