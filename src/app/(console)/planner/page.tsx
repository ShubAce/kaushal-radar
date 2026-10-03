import type { Metadata } from "next";
import { PlannerView } from "./view";
import { isState } from "@/lib/data";

export const metadata: Metadata = { title: "Target planner" };

export default async function Page(props: PageProps<"/planner">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.state) ? sp.state[0] : sp.state;
  return <PlannerView initialState={isState(raw) ? raw : "MH"} />;
}
