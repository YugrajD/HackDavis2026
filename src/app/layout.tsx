import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian Road",
  description: "Shared-road safety sensing, replay, records, and danger mapping for Davis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
