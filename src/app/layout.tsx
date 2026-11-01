import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhasha — Bangla to English Practice",
  description: "Practice English by translating Bangla sentences and learning vocabulary.",
  applicationName: "Bhasha",
  appleWebApp: {
    capable: true,
    title: "Bhasha",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/bhasha-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#285741",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
