/**
 * Downloads the handful of OpenStreetMap tiles the disease map needs and
 * stores them in client/public/map-tiles/, so the app serves its own map
 * background: no API key, no third-party request at run time, and it works
 * on an office network without internet.
 *
 * The disease map is a fixed view of one municipality (no zoom, no pan),
 * so it only ever asks for the tiles computed below. Re-run this only if
 * the barangay points in shared/placer-barangays.ts change or the map gets a new size:
 *
 *   node script/fetch-map-tiles.mjs            download missing tiles
 *   node script/fetch-map-tiles.mjs --list     only print what would be fetched
 *
 * OpenStreetMap's tile usage policy forbids downloading more than 250 tiles
 * at zoom 13+ for offline use; the script refuses to exceed that, fetches
 * one tile at a time and never re-downloads a tile it already has.
 * https://operations.osmfoundation.org/policies/tiles/
 */
import fs from "fs";
import path from "path";

// Centre of PLACER_MAP_BOUNDS in shared/placer-barangays.ts (the box around
// the 20 barangay points). Update both together.
const CENTER = { lat: 9.6529, lng: 125.6004 };
const MAP_HEIGHT = 600; // px, fixed in disease-map.tsx
// Leaflet picks the zoom that fits the bounds into the container. Widest
// container that still gets each zoom (the map is capped at 1150 px wide):
const VIEWS = [
  { zoom: 11, maxWidth: 372 },
  { zoom: 12, maxWidth: 684 },
  { zoom: 13, maxWidth: 1150 },
];
const OUT_DIR = path.resolve(import.meta.dirname, "../client/public/map-tiles");
const POLICY_LIMIT = 250;

function centerPixel(zoom) {
  const scale = 256 * 2 ** zoom;
  const x = ((CENTER.lng + 180) / 360) * scale;
  const s = Math.sin((CENTER.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

const wanted = new Map(); // "z/x/y" -> [z, x, y]
function addView(tileZoom, width, height) {
  const c = centerPixel(tileZoom);
  for (let x = Math.floor((c.x - width / 2) / 256); x <= Math.floor((c.x + width / 2) / 256); x++) {
    for (let y = Math.floor((c.y - height / 2) / 256); y <= Math.floor((c.y + height / 2) / 256); y++) {
      wanted.set(`${tileZoom}/${x}/${y}`, [tileZoom, x, y]);
    }
  }
}
for (const view of VIEWS) {
  addView(view.zoom, view.maxWidth, MAP_HEIGHT); // ordinary screens
  addView(view.zoom + 1, view.maxWidth * 2, MAP_HEIGHT * 2); // high-density screens use the next zoom
}

const tiles = [...wanted.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
const deep = tiles.filter(([z]) => z >= 13).length;
const perZoom = tiles.reduce((acc, [z]) => ({ ...acc, [z]: (acc[z] || 0) + 1 }), {});
console.log(`${tiles.length} tiles needed`, perZoom, `(${deep} at zoom 13+)`);
if (deep > POLICY_LIMIT) {
  console.error(`Refusing: more than ${POLICY_LIMIT} tiles at zoom 13+ breaks the OpenStreetMap tile usage policy.`);
  process.exit(1);
}
if (process.argv.includes("--list")) process.exit(0);

let fetched = 0;
for (const [z, x, y] of tiles) {
  const file = path.join(OUT_DIR, String(z), String(x), `${y}.png`);
  if (fs.existsSync(file)) continue;
  const res = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": "static-map-prefetch/1.0 (one-off; under 250 tiles; no bulk use)" },
  });
  if (!res.ok) {
    console.error(`FAILED ${z}/${x}/${y}: HTTP ${res.status}`);
    process.exit(1);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (body.subarray(1, 4).toString() !== "PNG") {
    console.error(`FAILED ${z}/${x}/${y}: not a PNG image`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  fetched++;
  await new Promise((r) => setTimeout(r, 400)); // be gentle with a volunteer-run service
}
console.log(`${fetched} downloaded, ${tiles.length - fetched} already present, in ${OUT_DIR}`);
