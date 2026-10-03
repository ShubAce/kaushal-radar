import type { Metadata } from "next";
import { MapperView } from "./view";

export const metadata: Metadata = { title: "Job-ad mapper" };

export default function Page() {
  return <MapperView />;
}
