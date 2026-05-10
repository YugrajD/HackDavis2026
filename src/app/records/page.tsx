import type { Metadata } from "next";
import { RecordsConsole } from "@/components/records/RecordsConsole";

export const metadata: Metadata = {
  title: "Records | Guardian Road",
  description: "Evidence feed, danger segments, and civic safety report export for Guardian Road.",
};

export default function RecordsPage() {
  return <RecordsConsole />;
}
