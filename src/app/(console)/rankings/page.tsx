import type { Metadata } from "next";
import { RankingsView } from "./view";

export const metadata: Metadata = { title: "Rankings" };

export default function Page() {
  return <RankingsView />;
}
