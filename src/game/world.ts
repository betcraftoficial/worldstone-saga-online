// Deterministic world layout shared by rendering, collision and the minimap.
import { CITIES, ZONES, WORLD_SIZE, biomeAt, type Biome } from "./data";

export function hash(x: number, z: number) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function heightAt(x: number, z: number) {
  let h = Math.sin(x * 0.031) * Math.cos(z * 0.027) * 1.4 + Math.sin(x * 0.083 + z * 0.061) * 0.5;
  const b = biomeAt(x, z);
  if (b === "snow") h += Math.max(0, Math.sin(x * 0.05) * Math.cos(z * 0.045)) * 3;
  if (b === "desert") h += Math.sin(x * 0.06 + z * 0.02) * 0.9;
  for (const c of CITIES) {
    const d = Math.hypot(c.x - x, c.z - z);
    h *= smooth(c.radius * 0.8, c.radius + 12, d);
  }
  for (const zn of ZONES) {
    if (zn.kind === "pvp") h *= smooth(zn.radius * 0.9, zn.radius + 6, Math.hypot(zn.x - x, zn.z - z));
  }
  return h;
}

export const ROADS: [number, number, number, number][] = [
  ...CITIES.slice(1).map((c) => [0, 0, c.x, c.z] as [number, number, number, number]),
  [0, 0, 0, -205], [0, 0, 75, 85], [-165, 150, -225, 225], [170, 165, 225, 235], [0, 0, -70, -60],
  [175, -115, 170, 165], [-180, -145, -165, 150],
];
export function roadDist(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of ROADS) {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

export const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  plains: [0.36, 0.6, 0.27],
  coast: [0.42, 0.62, 0.32],
  desert: [0.86, 0.68, 0.42],
  forest: [0.17, 0.33, 0.2],
  snow: [0.9, 0.93, 0.97],
};

export function groundColor(x: number, z: number): [number, number, number] {
  const b = biomeAt(x, z);
  let [r, g, bl] = BIOME_COLORS[b];
  const n = hash(Math.floor(x / 3), Math.floor(z / 3)) * 0.08 - 0.04;
  r += n; g += n; bl += n;
  const rd = roadDist(x, z);
  if (rd < 3) { const t = 1 - rd / 3; r = r * (1 - t) + 0.55 * t; g = g * (1 - t) + 0.44 * t; bl = bl * (1 - t) + 0.3 * t; }
  for (const c of CITIES) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < c.radius) { const t = Math.min(1, (c.radius - d) / 4) * 0.85; r = r * (1 - t) + 0.62 * t; g = g * (1 - t) + 0.58 * t; bl = bl * (1 - t) + 0.52 * t; }
  }
  for (const zn of ZONES) {
    const d = Math.hypot(zn.x - x, zn.z - z);
    if (d < zn.radius) {
      const t = Math.min(1, (zn.radius - d) / 6) * 0.75;
      const col = zn.kind === "pvp" ? [0.45, 0.2, 0.15] : zn.kind === "dungeon" ? [0.18, 0.16, 0.17] : [0.28, 0.12, 0.1];
      r = r * (1 - t) + col[0] * t; g = g * (1 - t) + col[1] * t; bl = bl * (1 - t) + col[2] * t;
    }
  }
  return [r, g, bl];
}

// ---------- Buildings & colliders ----------
export type Box = { x: number; z: number; w: number; d: number; h: number; roof: string; wall: string; rot: number };
export const BUILDINGS: Box[] = (() => {
  const out: Box[] = [];
  const palette: Record<Biome, { wall: string; roof: string }> = {
    plains: { wall: "#e8dcc2", roof: "#a8442f" },
    coast: { wall: "#f1ede4", roof: "#2f6f9f" },
    desert: { wall: "#d9b47e", roof: "#b9874b" },
    forest: { wall: "#6b4f35", roof: "#3c5a2e" },
    snow: { wall: "#cbb79a", roof: "#5a6470" },
  };
  CITIES.forEach((c, ci) => {
    const p = palette[c.biome];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.26;
      // leave four gates open (cardinal directions)
      const near = Math.min(...[0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2].map((g) => Math.abs(a - g)));
      if (near < 0.3) continue;
      const r = c.radius * 0.78;
      const w = 5 + hash(ci, i) * 2.5, d = 5 + hash(i, ci) * 2;
      out.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, w, d, h: 3.5 + hash(i * 3, ci) * 2.5, roof: p.roof, wall: p.wall, rot: -a });
    }
    // temple
    out.push({ x: c.x, z: c.z - c.radius * 0.5, w: 9, d: 6, h: 6.5, roof: "#d4a73c", wall: "#efe7d6", rot: 0 });
  });
  return out;
})();

export function collide(x: number, z: number, r = 0.5): [number, number] {
  for (const b of BUILDINGS) {
    // rotate into box space
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
    const lx = (x - b.x) * c - (z - b.z) * s;
    const lz = (x - b.x) * s + (z - b.z) * c;
    const hw = b.w / 2 + r, hd = b.d / 2 + r;
    if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
      const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
      let nx = lx, nz = lz;
      if (px < pz) nx = Math.sign(lx) * hw; else nz = Math.sign(lz) * hd;
      const ic = Math.cos(b.rot), is = Math.sin(b.rot);
      x = b.x + nx * ic - nz * is;
      z = b.z + nx * is + nz * ic;
    }
  }
  const lim = WORLD_SIZE - 4;
  return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))];
}

// ---------- Vegetation ----------
export type Prop = { x: number; z: number; s: number; r: number; kind: "tree" | "pine" | "palm" | "cactus" | "rock" | "deadtree" | "crystal" };
export const PROPS: Prop[] = (() => {
  const out: Prop[] = [];
  const step = 6.5;
  for (let x = -WORLD_SIZE + 6; x < WORLD_SIZE - 6; x += step) {
    for (let z = -WORLD_SIZE + 6; z < WORLD_SIZE - 6; z += step) {
      const jx = x + (hash(x, z) - 0.5) * step;
      const jz = z + (hash(z, x) - 0.5) * step;
      if (CITIES.some((c) => Math.hypot(c.x - jx, c.z - jz) < c.radius + 5)) continue;
      if (roadDist(jx, jz) < 5) continue;
      const zone = ZONES.find((zn) => Math.hypot(zn.x - jx, zn.z - jz) < zn.radius);
      const rnd = hash(jx * 1.3, jz * 0.7);
      const s = 0.8 + hash(jz, jx * 2) * 0.7;
      const r = hash(jx, jz * 3) * Math.PI * 2;
      if (zone) {
        if (zone.kind === "pvp") continue;
        if (rnd < 0.22) out.push({ x: jx, z: jz, s: s * 1.3, r, kind: "rock" });
        else if (rnd < 0.3) out.push({ x: jx, z: jz, s, r, kind: "crystal" });
        else if (rnd < 0.4) out.push({ x: jx, z: jz, s, r, kind: "deadtree" });
        continue;
      }
      const b = biomeAt(jx, jz);
      const dens = { plains: 0.28, coast: 0.2, desert: 0.1, forest: 0.62, snow: 0.3 }[b];
      if (rnd > dens) { if (rnd > 0.96) out.push({ x: jx, z: jz, s: s * 0.8, r, kind: "rock" }); continue; }
      const kind: Prop["kind"] = b === "desert" ? (rnd < 0.05 ? "palm" : "cactus") : b === "snow" ? "pine" : b === "forest" ? (rnd < 0.45 ? "pine" : "tree") : b === "coast" ? (rnd < 0.1 ? "palm" : "tree") : "tree";
      out.push({ x: jx, z: jz, s, r, kind });
    }
  }
  return out;
})();
