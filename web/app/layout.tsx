import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian Road",
  description:
    "Guardian Road is a phone-mounted hazard dashcam for cyclists, scooter riders, and drivers — real-time voice alerts, saved clips, and danger-zone analytics for the city.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400&family=Inter:wght@100;300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
