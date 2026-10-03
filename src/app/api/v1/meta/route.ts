import { ok, preflight } from "@/lib/api";
import { meta } from "@/lib/data";

export const OPTIONS = preflight;

export function GET() {
  return ok(meta());
}
