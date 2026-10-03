import type { Metadata } from "next";
import { WarningsView } from "./view";
import { flags, isState, meta } from "@/lib/data";

export const metadata: Metadata = { title: "Early warnings" };

export default async function Page(props: PageProps<"/warnings">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <WarningsView flags={flags()} meta={meta()} initialState={isState(one(sp.state)) ? one(sp.state)! : ""} focus={one(sp.focus)} />;
}
