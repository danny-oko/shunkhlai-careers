/**
 * Regenerates public/brand/mongolia-dots.svg.
 *
 * This feeds the landing page's opening loader (<SiteLoader>). It is
 * checked in, so this only needs running if the dot pitch or the projection
 * changes:  node scripts/generate-map-dots.mjs
 *
 * Source: Natural Earth 110m via the world-atlas package. Output is an
 * equirectangular 3600x1800 mask (0.1 degree per unit) drawn as a single
 * <path> of zero-length round-capped segments — one element, not thousands.
 */
import { writeFile } from "node:fs/promises";

const COUNTRIES = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const W = 3600;
const H = 1800;
const MONGOLIA_STEP = 0.42;

function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

/** A ring is a list of arc indices; a negative index means that arc reversed. */
function ring(arcs, indices) {
  const out = [];
  for (const i of indices) {
    const line = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    out.push(...(out.length ? line.slice(1) : line));
  }
  return out;
}

function polygons(arcs, geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs.map((r) => ring(arcs, r))];
  if (geometry.type === "MultiPolygon")
    return geometry.arcs.map((p) => p.map((r) => ring(arcs, r)));
  return [];
}

/** Even-odd ray casting across every ring, so holes punch through. */
function inside(poly, lon, lat) {
  let hit = false;
  for (const r of poly) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        hit = !hit;
    }
  }
  return hit;
}

function withBox(polys) {
  return polys.map((poly) => {
    let x0 = 180;
    let y0 = 90;
    let x1 = -180;
    let y1 = -90;
    for (const r of poly)
      for (const [x, y] of r) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    return { poly, box: [x0, y0, x1, y1] };
  });
}

const hits = (polys, lon, lat) =>
  polys.some(
    ({ poly, box }) =>
      lon >= box[0] &&
      lon <= box[2] &&
      lat >= box[1] &&
      lat <= box[3] &&
      inside(poly, lon, lat),
  );

const px = (lon) => Math.round(((lon + 180) / 360) * W);
const py = (lat) => Math.round(((90 - lat) / 180) * H);

const grid = (lonRange, latRange, step, test) => {
  const points = [];
  for (let lat = latRange[1]; lat >= latRange[0]; lat -= step)
    for (let lon = lonRange[0]; lon <= lonRange[1]; lon += step)
      if (test(lon, lat)) points.push([px(lon), py(lat)]);
  return points;
};

const toPath = (points) => points.map(([x, y]) => `M${x} ${y}l0 0`).join("");

// Cropped to Mongolia, so the file can be dropped straight into a box of the
// country's own aspect ratio. Coordinates stay in world space.
const VIEW_BOX = "2668 372 340 122";

const svg = (path, dot) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">` +
  `<path fill="none" stroke="#000" stroke-width="${dot}" stroke-linecap="round" d="${path}"/>` +
  `</svg>\n`;

const json = async (url) => (await fetch(url)).json();

const countryTopo = await json(COUNTRIES);

const mongolia = withBox(
  polygons(
    decodeArcs(countryTopo),
    countryTopo.objects.countries.geometries.find((g) => g.properties?.name === "Mongolia"),
  ),
);

const mongoliaDots = grid([86, 121], [41, 53], MONGOLIA_STEP, (lon, lat) =>
  hits(mongolia, lon, lat));

// Dots sit at ~60% of the grid pitch, so they read as dots, not as a fill.
const dotSize = (step) => ((step / 360) * W * 0.6).toFixed(2);

await writeFile("public/brand/mongolia-dots.svg", svg(toPath(mongoliaDots), dotSize(MONGOLIA_STEP)));

console.log(`mongolia ${mongoliaDots.length} dots`);
