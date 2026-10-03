"use client";

import { useRouter } from "next/navigation";
import type { LayerRow } from "@/lib/data";
import { scoreFill } from "@/lib/scale";
import type { MapState } from "@/lib/types";

/** A small locator: the state's districts, with the current one outlined. Neighbours are links. */
export function StateMini({
  map, layer, current, href, label,
}: { map: MapState; layer: Record<string, LayerRow>; current: string; href: (id: string) => string; label: string }) {
  const router = useRouter();
  const [x0, y0, x1, y1] = map.box;
  const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
  const me = map.districts.find((d) => d.id === current);
  return (
    <svg
      viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`}
      role="group" aria-label={label} className="block h-full w-full" preserveAspectRatio="xMidYMid meet"
    >
      {map.districts.map((d) => (
        <path
          key={d.id}
          d={d.d}
          fill={scoreFill(layer[d.id]?.s1 ?? 0)}
          opacity={d.id === current ? 1 : 0.55}
          stroke="var(--surface)" strokeWidth={0.8} vectorEffect="non-scaling-stroke"
          style={{ cursor: d.id === current ? undefined : "pointer", transition: "opacity 0.15s" }}
          onClick={d.id === current ? undefined : () => router.push(href(d.id))}
          onPointerEnter={(e) => d.id !== current && e.currentTarget.setAttribute("opacity", "0.9")}
          onPointerLeave={(e) => d.id !== current && e.currentTarget.setAttribute("opacity", "0.55")}
        >
          <title>{d.name}</title>
        </path>
      ))}
      {me && <path d={me.d} fill="none" stroke="var(--ink)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" pointerEvents="none" />}
    </svg>
  );
}
