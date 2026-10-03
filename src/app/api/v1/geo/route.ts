import type { NextRequest } from "next/server";
import { envelope, fail, ok, preflight } from "@/lib/api";
import { geo, isState } from "@/lib/data";

export const OPTIONS = preflight;

export function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (state && !isState(state)) return fail(400, `Unknown state "${state}". Use one of the ids from /api/v1/geo.`);
  const g = geo();
  return ok({
    meta: envelope(),
    states: g.states,
    districts: state ? g.districts.filter((d) => d.state === state) : g.districts,
  });
}
