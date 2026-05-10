import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "./SmoothScroll";

export const metadata: Metadata = {
  title: "Semicolon",
  description:
    "Semicolon is a native iOS hazard dashcam for cyclists, scooter riders, and drivers — multicam capture, LiDAR-aware perception, on-device voice alerts, and danger-zone analytics for the city.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Inter at variable weights — closest free analog to PP Neue Montreal at 350 */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;350;400;500;600&display=swap"
        />
      </head>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
