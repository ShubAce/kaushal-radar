import type { Metadata } from "next";
import { ApiDocsView } from "./view";

export const metadata: Metadata = { title: "API and export" };

export default function Page() {
  return <ApiDocsView />;
}
