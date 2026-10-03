import type { Metadata } from "next";
import { DataView } from "./view";
import { meta, method } from "@/lib/data";

export const metadata: Metadata = { title: "Data sources" };

export default function Page() {
  return <DataView method={method()} meta={meta()} />;
}
