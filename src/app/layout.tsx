import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian Road — Shared-Road Safety Intelligence",
  description: "AI dashcam capture, depth-assisted hazard sensing, replay, and civic safety reports for shared roads.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-asphalt text-roadText antialiased">{children}</body>
    </html>
  );
}
