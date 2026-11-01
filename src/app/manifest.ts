import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bhasha — Bangla to English Practice",
    short_name: "Bhasha",
    description: "Practice English with Bangla sentences and vocabulary.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f3",
    theme_color: "#285741",
    icons: [
      { src: "/bhasha-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/bhasha-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/bhasha-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
