import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian Road — Safety Ops",
  description: "Shared-road hazard sensing, live capture, replay data, danger segments, and civic safety reports for Davis streets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-asphalt text-roadText antialiased">{children}</body>
    </html>
  );
}
