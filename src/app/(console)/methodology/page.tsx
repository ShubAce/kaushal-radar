import type { Metadata } from "next";
import { MethodView } from "./view";
import { method } from "@/lib/data";

export const metadata: Metadata = { title: "Methodology" };

export default function Page() {
  return <MethodView method={method()} />;
}
