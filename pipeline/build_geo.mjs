// Pre-projects the India boundary file into SVG path strings, so the browser
// draws the map without any geo library. One shared coordinate space (Mercator,
// 1000 units wide) is used for states and districts, which lets the map zoom
// from the country into a state by animating the viewBox.
//
//   node pipeline/build_geo.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const here = dirname(fileURLToPath(import.meta.url));
const topo = JSON.parse(readFileSync(join(here, "raw", "india.topo.json"), "utf8"));
const districtIndex = JSON.parse(readFileSync(join(here, "build", "districts.json"), "utf8"));
const out = join(here, "..", "data", "geo");
mkdirSync(out, { recursive: true });

const PILOT = { Maharashtra: "MH", "Tamil Nadu": "TN", "Uttar Pradesh": "UP", Gujarat: "GJ" };
const W = 1000;
const rad = Math.PI / 180;
const mercY = (lat) => -Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)) / rad;

const states = feature(topo, topo.objects.states).features;
const districts = feature(topo, topo.objects.districts).features;

const rings = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const f of states)
  for (const poly of rings(f.geometry))
    for (const ring of poly)
      for (const [lon, lat] of ring) {
        const y = mercY(lat);
        if (lon < minX) minX = lon;
        if (lon > maxX) maxX = lon;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
const k = W / (maxX - minX);
const H = Math.ceil((maxY - minY) * k);
const project = ([lon, lat]) => [(lon - minX) * k, (mercY(lat) - minY) * k];

function shape(geom, digits) {
  const f = 10 ** digits;
  const r = (v) => Math.round(v * f) / f;
  let d = "";
  let best = { area: 0, c: [0, 0] };
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of rings(geom)) {
    poly.forEach((ring, ri) => {
      const pts = ring.map(project);
      let prev = "";
      pts.forEach(([x, y], i) => {
        const cmd = `${r(x)},${r(y)}`;
        if (cmd === prev) return;                    // drop points that round to the same pixel
        d += (i === 0 ? "M" : "L") + cmd;
        prev = cmd;
        if (x < box[0]) box[0] = x;
        if (y < box[1]) box[1] = y;
        if (x > box[2]) box[2] = x;
        if (y > box[3]) box[3] = y;
      });
      d += "Z";
      if (ri === 0) {                                // centroid of the largest outer ring, for labels
        let a = 0, cx = 0, cy = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const cross = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
          a += cross;
          cx += (pts[i][0] + pts[i + 1][0]) * cross;
          cy += (pts[i][1] + pts[i + 1][1]) * cross;
        }
        if (Math.abs(a) > best.area) best = { area: Math.abs(a), c: [r(cx / (3 * a)), r(cy / (3 * a))] };
      }
    });
  }
  return { d, c: best.c, box: box.map((v) => Math.round(v * 10) / 10) };
}

const india = {
  w: W,
  h: H,
  states: states.map((f) => {
    const s = shape(f.geometry, 1);
    const name = f.properties.st_nm;
    return { id: PILOT[name] ?? `X${f.properties.st_code}`, name, pilot: name in PILOT, d: s.d, c: s.c, box: s.box };
  }),
};
writeFileSync(join(out, "india.json"), JSON.stringify(india));

const idOf = new Map(districtIndex.map((r) => [`${r.state}|${r.raw}`, r]));
let total = 0;
for (const [stateName, code] of Object.entries(PILOT)) {
  const list = [];
  for (const f of districts) {
    if (f.properties.st_nm !== stateName) continue;
    const rec = idOf.get(`${code}|${f.properties.district}`);
    if (!rec) throw new Error(`no district record for ${stateName} / ${f.properties.district}`);
    const s = shape(f.geometry, 2);
    list.push({ id: rec.id, name: rec.name, d: s.d, c: s.c, box: s.box });
  }
  const box = india.states.find((s) => s.id === code).box;
  const body = JSON.stringify({ state: code, box, districts: list });
  writeFileSync(join(out, `${code}.json`), body);
  total += body.length;
  console.log(code, list.length, "districts,", Math.round(body.length / 1024), "KB");
}
console.log("india.json", Math.round(JSON.stringify(india).length / 1024), "KB | viewBox 0 0", W, H, "| districts total", Math.round(total / 1024), "KB");
