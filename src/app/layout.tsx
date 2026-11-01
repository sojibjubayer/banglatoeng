import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhasha — Bangla to English Practice",
  description: "Practice English by translating Bangla sentences and learning vocabulary.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
