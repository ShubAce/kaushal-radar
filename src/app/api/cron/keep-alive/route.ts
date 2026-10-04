import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(
    { ok: true, service: "kaushal-radar", checkedAt: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
