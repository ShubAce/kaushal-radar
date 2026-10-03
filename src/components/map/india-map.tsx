"use client";

// The drill-down map. States and districts share one coordinate space, so going
// from India to a state is a camera move (an animated viewBox), not a redraw.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Tip, useSize } from "@/components/charts/base";
import { ClassChip } from "@/components/ui/badges";
import type { LayerRow } from "@/lib/data";
import { compact, signed } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { classOf, scoreFill } from "@/lib/scale";
import type { MapIndia, MapState } from "@/lib/types";

type Box = [number, number, number, number];
type Layer = Record<string, LayerRow>;

interface Props {
  india: MapIndia;
  states: Record<string, MapState>;
  districts: Layer;
  stateRows: Layer;
  view: "now" | "next";
  focus: string | null;
  onFocus: (state: string | null) => void;
  districtHref: (id: string) => string;
  blips?: string[];
  names: (id: string) => string;
}

/** Grow a bounding box to the container's aspect ratio, with breathing room. */
function fit([x0, y0, x1, y1]: Box, aspect: number, pad = 0.07): Box {
  let w = (x1 - x0) * (1 + 2 * pad);
  let h = (y1 - y0) * (1 + 2 * pad);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

export function IndiaMap({ india, states, districts, stateRows, view, focus, onFocus, districtHref, blips = [], names }: Props) {
  const { t } = useT();
  const { prefs } = usePrefs();
  const router = useRouter();
  const [wrap, { w, h: height }] = useSize<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  const cur = useRef<Box | null>(null);
  const [hover, setHover] = useState<{ id: string; kind: "state" | "district"; x: number; y: number } | null>(null);

  const aspect = w > 0 && height > 0 ? w / height : 1;
  // With no state selected the camera frames the pilot states, not the whole country.
  const home = useMemo<Box>(() => {
    const b = Object.values(states).map((s) => s.box);
    return [Math.min(...b.map((x) => x[0])), Math.min(...b.map((x) => x[1])), Math.max(...b.map((x) => x[2])), Math.max(...b.map((x) => x[3]))];
  }, [states]);
  const target = useMemo<Box>(() => fit(focus ? states[focus].box : home, aspect, focus ? 0.09 : 0.05), [focus, states, home, aspect]);

  // Move the camera. The viewBox and the label scale are written straight to the DOM each frame.
  useEffect(() => {
    const el = svg.current;
    if (!el || w === 0) return;
    const apply = (b: Box) => {
      el.setAttribute("viewBox", b.map((v) => v.toFixed(2)).join(" "));
      el.style.setProperty("--k", String(b[2] / w));
      cur.current = b;
    };
    const from = cur.current;
    if (!from || prefs.motion === "reduced") return apply(target);
    const controls = animate(0, 1, {
      duration: 0.75,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (p) => apply(from.map((v, i) => v + (target[i] - v) * p) as Box),
    });
    return () => controls.stop();
  }, [target, w, prefs.motion]);

  const score = (r?: LayerRow) => (r ? (view === "now" ? r.s0 : r.s1) : 0);
  const fill = (r?: LayerRow) => (!r || r.act === 0 ? "var(--cls-none)" : scoreFill(score(r)));

  const districtPaths = useMemo(
    () =>
      Object.values(states).flatMap((s) =>
        s.districts.map((d) => ({ ...d, state: s.state })),
      ),
    [states],
  );
  const blipSet = useMemo(() => new Set(blips), [blips]);
  const pilot = india.states.filter((s) => s.pilot);

  const move = (e: React.PointerEvent, id: string, kind: "state" | "district") => {
    const rect = wrap.current!.getBoundingClientRect();
    setHover({ id, kind, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const focusTip = (e: React.FocusEvent<SVGPathElement>, id: string, kind: "state" | "district") => {
    const rect = wrap.current!.getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    setHover({ id, kind, x: b.left + b.width / 2 - rect.left, y: b.top + b.height / 2 - rect.top });
  };

  const row = hover ? (hover.kind === "state" ? stateRows[hover.id] : districts[hover.id]) : undefined;
  const hovered = hover?.kind === "district" ? districtPaths.find((d) => d.id === hover.id) : undefined;

  return (
    <div ref={wrap} className="relative h-full min-h-[440px] w-full overflow-hidden rounded-xl">
      {focus && (
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="absolute left-2 top-2 z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface/90 px-2.5 text-[13px] font-medium text-ink shadow-sm backdrop-blur hover:bg-surface-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("dash.mapBack")}
        </button>
      )}
      <svg
        ref={svg}
        width="100%" height="100%"
        viewBox={`0 0 ${india.w} ${india.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`${t("dash.mapTitle")}: ${focus ? names(focus) : t("common.india")}`}
        className="absolute inset-0 block"
        onPointerLeave={() => setHover(null)}
      >
        <g>
          {india.states.filter((s) => !s.pilot).map((s) => (
            <path key={s.id} d={s.d} fill="var(--cls-none)" stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <g>
          {districtPaths.map((d) => {
            const active = focus === d.state;
            return (
              <path
                key={d.id}
                d={d.d}
                fill={fill(districts[d.id])}
                stroke="var(--surface)"
                strokeWidth={focus ? 1.2 : 0.6}
                vectorEffect="non-scaling-stroke"
                style={{ transition: "fill 0.35s ease, opacity 0.35s ease", opacity: focus && !active ? 0.35 : 1, cursor: active ? "pointer" : undefined }}
                pointerEvents={active ? "auto" : "none"}
                tabIndex={active ? 0 : undefined}
                role={active ? "link" : undefined}
                aria-label={active ? `${d.name}: ${t(`cls.${classOf(score(districts[d.id]))}`)}` : undefined}
                onPointerMove={active ? (e) => move(e, d.id, "district") : undefined}
                onFocus={active ? (e) => focusTip(e, d.id, "district") : undefined}
                onBlur={active ? () => setHover(null) : undefined}
                onClick={active ? () => router.push(districtHref(d.id)) : undefined}
                onKeyDown={active ? (e) => (e.key === "Enter" || e.key === " ") && router.push(districtHref(d.id)) : undefined}
              />
            );
          })}
        </g>
        <g>
          {pilot.map((s) => {
            const on = hover?.kind === "state" && hover.id === s.id;
            const clickable = focus !== s.id;
            return (
              <path
                key={s.id}
                d={s.d}
                fill="transparent"
                stroke={on ? "var(--ink)" : "var(--ink-2)"}
                strokeWidth={on ? 2.2 : focus === s.id ? 1.6 : 1.1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                pointerEvents={clickable ? "auto" : "none"}
                style={{ cursor: clickable ? "pointer" : undefined, transition: "stroke-width 0.15s" }}
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? "button" : undefined}
                aria-label={clickable ? `${names(s.id)}: ${t(`cls.${classOf(score(stateRows[s.id]))}`)}` : undefined}
                onPointerMove={clickable ? (e) => move(e, s.id, "state") : undefined}
                onFocus={clickable ? (e) => focusTip(e, s.id, "state") : undefined}
                onBlur={clickable ? () => setHover(null) : undefined}
                onClick={clickable ? () => { setHover(null); onFocus(s.id); } : undefined}
                onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onFocus(s.id) : undefined}
              />
            );
          })}
        </g>
        {hovered && (
          <path d={hovered.d} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" pointerEvents="none" />
        )}
        <g pointerEvents="none">
          {districtPaths.filter((d) => blipSet.has(d.id) && (!focus || focus === d.state)).map((d) => (
            <g key={d.id} style={{ transform: `translate(${d.c[0]}px, ${d.c[1]}px) scale(var(--k, 1))` }}>
              <circle r={4} fill="var(--st-critical)" opacity={0.5} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite" }} />
              <circle r={2.6} fill="var(--st-critical)" stroke="var(--surface)" strokeWidth={1.2} />
            </g>
          ))}
        </g>
        {!focus && (
          <g pointerEvents="none">
            {pilot.map((s) => (
              <g key={s.id} style={{ transform: `translate(${s.c[0]}px, ${s.c[1]}px) scale(var(--k, 1))` }}>
                <text textAnchor="middle" dy="0.32em" className="fill-ink text-[12px] font-semibold" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                  {names(s.id)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>

      <Tip show={!!hover && !!row} x={hover?.x ?? 0} y={hover?.y ?? 0} width={w}>
        {hover && row && (
          <>
            <div className="font-semibold text-ink">{names(hover.id)}</div>
            <div className="mt-1"><ClassChip score={score(row)} className="text-xs" /></div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-muted">{t("common.demand")}</dt>
              <dd className="tabular text-right font-medium text-ink">{compact(view === "now" ? row.dn : row.dx)}</dd>
              <dt className="text-muted">{t("common.supply")}</dt>
              <dd className="tabular text-right font-medium text-ink">{compact(view === "now" ? row.sn : row.sx)}</dd>
              <dt className="text-muted">{t("common.gap")}</dt>
              <dd className="tabular text-right font-medium text-ink">{signed(view === "now" ? row.dn - row.sn : row.dx - row.sx, compact)}</dd>
              {row.mi !== undefined && (
                <>
                  <dt className="text-muted">{t("dash.colMismatch")}</dt>
                  <dd className="tabular text-right font-medium text-ink">{row.mi}%</dd>
                </>
              )}
            </dl>
          </>
        )}
      </Tip>
    </div>
  );
}
