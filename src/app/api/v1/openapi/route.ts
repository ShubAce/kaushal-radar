import type { NextRequest } from "next/server";
import { ok, preflight } from "@/lib/api";
import { meta } from "@/lib/data";
import { ENDPOINTS } from "@/lib/endpoints";

export const OPTIONS = preflight;

/** OpenAPI 3.1 description of this API, generated from the same list the docs screen uses. */
export function GET(req: NextRequest) {
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const responses = { "200": { description: "OK" }, "400": { description: "Invalid parameter; the body explains which one" } };
    paths[e.path] = {
      [e.method.toLowerCase()]: e.method === "GET"
        ? {
            summary: e.summary, operationId: e.id, responses,
            parameters: e.params.map((p) => ({ name: p.name, in: "query", required: !!p.required, description: p.values, schema: { type: "string" } })),
          }
        : {
            summary: e.summary, operationId: e.id, responses,
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object", required: e.params.filter((p) => p.required).map((p) => p.name),
                    properties: Object.fromEntries(e.params.map((p) => [p.name, { type: "string", description: p.values }])),
                  },
                  example: JSON.parse(e.example),
                },
              },
            },
          },
    };
  }
  return ok({
    openapi: "3.1.0",
    info: {
      title: "Kaushal Radar API", version: "1.0.0",
      description: `Labour market intelligence for skilling planners: demand index, gap forecasts, early warnings and seat plans.${meta().demo ? " Demo data." : ""}`,
    },
    servers: [{ url: req.nextUrl.origin }],
    paths,
  });
}
