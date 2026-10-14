import * as THREE from "three/webgpu";
import {
  abs,
  attribute,
  exp,
  float,
  pow,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { glassIor, refract } from "./optics";

/** Closed outline segments with smooth outward normals at both ends. */
export type Outline = {
  /** ax, ay, bx, by, nax, nay, nbx, nby per segment. */
  segments: Float32Array;
  count: number;
};

/** Builds a tracing outline from glyph contours. Outer contours and holes may
 * arrive in either winding; outward normals always point from glass into air.
 * `offset` grows the outline to match the extrusion's bevel at mid-depth. */
export function buildOutline(
  contours: {
    outer: { x: number; y: number }[];
    holes: { x: number; y: number }[][];
  }[],
  offset = 0,
): Outline {
  const loops: { x: number; y: number }[][] = [];
  for (const { outer, holes } of contours) {
    loops.push(orient(outer, 1));
    for (const hole of holes) loops.push(orient(hole, -1));
  }
  const total = loops.reduce((sum, loop) => sum + loop.length, 0);
  const segments = new Float32Array(total * 8);
  let s = 0;
  for (const loop of loops) {
    const n = loop.length;
    const edges = loop.map((p, i) => edgeNormal(p, loop[(i + 1) % n]));
    // Smooth curves get averaged vertex normals; sharp corners (font
    // terminals) keep each face flat. Offsets use a miter so faces stay put.
    const smooth: boolean[] = [];
    const vertexNormals = loop.map((_, i) => {
      const a = edges[(i - 1 + n) % n];
      const b = edges[i];
      smooth.push(a[0] * b[0] + a[1] * b[1] > Math.cos(Math.PI / 6));
      const length = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      return [(a[0] + b[0]) / length, (a[1] + b[1]) / length];
    });
    const grown = loop.map((p, i) => {
      const normal = vertexNormals[i];
      const miter =
        offset /
        Math.max(0.3, normal[0] * edges[i][0] + normal[1] * edges[i][1]);
      return [p.x + normal[0] * miter, p.y + normal[1] * miter];
    });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const start = smooth[i] ? vertexNormals[i] : edges[i];
      const end = smooth[j] ? vertexNormals[j] : edges[i];
      segments.set([...grown[i], ...grown[j], ...start, ...end], s * 8);
      s++;
    }
  }
  return { segments, count: s };
}

function orient(points: { x: number; y: number }[], sign: number) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  // Drop the duplicated closing point some loaders emit.
  const first = points[0];
  const last = points[points.length - 1];
  const open =
    Math.hypot(first.x - last.x, first.y - last.y) < 1e-9
      ? points.slice(0, -1)
      : points.slice();
  return Math.sign(area) === sign ? open : open.reverse();
}

/** With positive signed area the interior lies left of each edge, so the
 * right-hand normal points out of the glass. */
function edgeNormal(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return [dy / length, -dx / length];
}

export type Trace = {
  /** x, y of the start and every surface hit. */
  points: number[];
  dx: number;
  dy: number;
  /** False when the ray is still inside glass after the last allowed hit. */
  escaped: boolean;
};

/** Follows one 2D ray through the outline with Snell refraction and total
 * internal reflection. */
export function traceRay(
  outline: Outline,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  ior: number,
  maxHits = 12,
): Trace {
  const points = [ox, oy];
  const seg = outline.segments;
  for (let hit = 0; hit < maxHits; hit++) {
    let best = Infinity;
    let bestIndex = -1;
    let bestU = 0;
    for (let i = 0; i < outline.count; i++) {
      const o = i * 8;
      const ax = seg[o],
        ay = seg[o + 1];
      const ex = seg[o + 2] - ax,
        ey = seg[o + 3] - ay;
      const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-12) continue;
      const qx = ax - ox,
        qy = ay - oy;
      const t = (qx * ey - qy * ex) / denominator;
      if (t <= 1e-6 || t >= best) continue;
      const u = (qx * dy - qy * dx) / denominator;
      if (u < 0 || u > 1) continue;
      best = t;
      bestIndex = i;
      bestU = u;
    }
    if (bestIndex < 0) return { points, dx, dy, escaped: true };
    const o = bestIndex * 8;
    const px = ox + dx * best;
    const py = oy + dy * best;
    let nx = seg[o + 4] + (seg[o + 6] - seg[o + 4]) * bestU;
    let ny = seg[o + 5] + (seg[o + 7] - seg[o + 5]) * bestU;
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    points.push(px, py);
    // The smooth normal is outward; face it against the incoming ray.
    const entering = nx * dx + ny * dy < 0;
    if (!entering) {
      nx = -nx;
      ny = -ny;
    }
    const bent = refract(dx, dy, nx, ny, entering ? 1 / ior : ior);
    if (bent) [dx, dy] = bent;
    else {
      // Total internal reflection keeps the ray inside the glass.
      const cosine = -(nx * dx + ny * dy);
      dx += 2 * cosine * nx;
      dy += 2 * cosine * ny;
    }
    ox = px + dx * 1e-5;
    oy = py + dy * 1e-5;
    if (hit === maxHits - 1) return { points, dx, dy, escaped: false };
  }
  return { points, dx, dy, escaped: false };
}

/** CIE 1931 colour matching (Wyman, Sloan and Shirley 2013) in linear sRGB,
 * clamped to the displayable gamut. */
export function wavelengthToRgb(nm: number) {
  const g = (x: number, mu: number, low: number, high: number) => {
    const s = x < mu ? low : high;
    return Math.exp(-0.5 * ((x - mu) / s) ** 2);
  };
  const X =
    1.056 * g(nm, 599.8, 37.9, 31) +
    0.362 * g(nm, 442, 16, 26.7) -
    0.065 * g(nm, 501.1, 20.4, 26.2);
  const Y = 0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1);
  const Z = 1.217 * g(nm, 437, 11.8, 36) + 0.681 * g(nm, 459, 26, 13.8);
  return [
    Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z),
    Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z),
    Math.max(0, 0.0557 * X - 0.204 * Y + 1.057 * Z),
  ];
}

const WAVELENGTHS = 48;
const BOUNDARIES = 11;
const MAX_HITS = 12;
const FAN_LENGTH = 32;
const SOURCE_DISTANCE = 24;
/** Target angle between violet and red in the outgoing fan, in radians. */
const FAN_SPREAD = 0.34;

export type LightAim = {
  /** Direction of travel in radians within the light's plane. */
  angle: number;
  /** Point the beam centre passes through. */
  x: number;
  y: number;
};

/**
 * One finite-width white beam traced through the letter's cross-section.
 *
 * Every sampled wavelength is a strip between adjacent beam boundary rays, so
 * all colours overlap into white where they coincide and separate as they
 * disperse. After the last exit, neighbouring wavelengths are joined into a
 * continuous fan per boundary ray. The sheet lies in the plane's z = 0 (the
 * letter's mid-depth) and renders before the glass, which refracts it like
 * any backdrop.
 */
export function createLightBeams(
  plane: THREE.Object3D,
  outline: Outline,
  rest: LightAim,
  options: { width?: number } = {},
) {
  const halfWidth = (options.width ?? 0.26) / 2;
  const raw = Array.from({ length: WAVELENGTHS }, (_, i) =>
    wavelengthToRgb(400 + (300 * i) / (WAVELENGTHS - 1)),
  );
  // A slight blur across neighbouring wavelengths gives the clamped sRGB
  // primaries their yellow and cyan transitions back.
  const spectrum = raw.map((_, i) => {
    const rgb = [0, 0, 0];
    let total = 0;
    for (let j = -4; j <= 4; j++) {
      const k = Math.min(WAVELENGTHS - 1, Math.max(0, i + j));
      const w = Math.exp(-(j * j) / 8);
      for (let c = 0; c < 3; c++) rgb[c] += raw[k][c] * w;
      total += w;
    }
    return rgb.map((v) => v / total);
  });
  // White-balance the samples so all wavelengths together sum to white.
  const mean = [0, 1, 2].map(
    (c) => spectrum.reduce((sum, rgb) => sum + rgb[c], 0) / WAVELENGTHS,
  );
  for (const rgb of spectrum) for (let c = 0; c < 3; c++) rgb[c] /= mean[c];

  const quads =
    BOUNDARIES -
    1 +
    WAVELENGTHS * (BOUNDARIES - 1) * MAX_HITS +
    BOUNDARIES * (WAVELENGTHS - 1);
  const vertices = quads * 6;
  const position = new THREE.BufferAttribute(
    new Float32Array(vertices * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.BufferAttribute(
    new Float32Array(vertices * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const profile = new THREE.BufferAttribute(
    new Float32Array(vertices),
    1,
  ).setUsage(THREE.DynamicDrawUsage);
  const travel = new THREE.BufferAttribute(
    new Float32Array(vertices),
    1,
  ).setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("color", color);
  geometry.setAttribute("profile", profile);
  geometry.setAttribute("travel", travel);

  // Gaussian across the beam, gentle geometric dilution along the fan.
  const radius = abs(attribute<"float">("profile", "float"));
  const radial = exp(radius.mul(radius).mul(-2.4)).mul(
    float(1).sub(smoothstep(0.6, 1, radius)),
  );
  const falloff = pow(
    attribute<"float">("travel", "float").mul(0.3).add(1),
    -1.5,
  );
  const material = new THREE.MeshBasicNodeMaterial({
    // Opaque-list additive light: drawn before transmission so the glass
    // refracts it, while still blending onto the wordmark behind.
    transparent: false,
    blending: THREE.AdditiveBlending,
    // The plane tilts with the letter and can pass behind the wordmark; light
    // should still land on it. It renders after the backdrop and before the
    // glass, so the glass still covers and refracts it.
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  // Switching on: the light brightens first, then the fan reaches outward.
  const reveal = uniform(1);
  const level = smoothstep(0, 0.35, reveal);
  const reach = reveal
    .sub(0.2)
    .max(0)
    .div(0.8)
    .pow(0.7)
    .mul(FAN_LENGTH * 1.2);
  const reached = float(1).sub(
    smoothstep(reach.sub(2.5), reach, attribute<"float">("travel", "float")),
  );
  material.colorNode = vec4(
    attribute<"vec3">("color", "vec3")
      .mul(radial)
      .mul(falloff)
      .mul(level)
      .mul(reached),
    1,
  );
  const sheet = new THREE.Mesh(geometry, material);
  sheet.name = "light-sheet";
  sheet.frustumCulled = false;
  sheet.renderOrder = 1;
  plane.add(sheet);

  let cursor = 0;
  const vertex = (
    x: number,
    y: number,
    rgb: number[],
    energy: number,
    p: number,
    t: number,
  ) => {
    position.setXYZ(cursor, x, y, 0);
    color.setXYZ(cursor, rgb[0] * energy, rgb[1] * energy, rgb[2] * energy);
    profile.setX(cursor, p);
    travel.setX(cursor, t);
    cursor++;
  };
  type Corner = [
    x: number,
    y: number,
    rgb: number[],
    energy: number,
    p: number,
    t: number,
  ];
  const quad = (a: Corner, b: Corner, c: Corner, d: Corner) => {
    // a-b at the start, c-d at the end; c continues a, d continues b.
    for (const corner of [a, b, c, b, d, c]) vertex(...corner);
  };

  const white = [1, 1, 1];
  const boundaryProfile = (b: number) => -1 + (2 * b) / (BOUNDARIES - 1);
  // Beam slices must stay one coherent band; a larger jump means neighbours
  // hit different strokes, and that seam is left open.
  const maxGap = halfWidth * 2 * 3;
  const close = (ax: number, ay: number, bx: number, by: number) =>
    Math.hypot(ax - bx, ay - by) < maxGap;

  const current: LightAim = { ...rest };
  // Where the light is, for anything that scatters it (dust).
  const field = {
    sx: 0,
    sy: 0,
    ex: 0,
    ey: 0,
    dx: 0,
    dy: 0,
    fan: false,
    fx: 0,
    fy: 0,
    exit: 0,
    sign: 1,
  };
  const target: LightAim = { ...rest };

  function rebuild() {
    cursor = 0;
    const dx = Math.cos(current.angle);
    const dy = Math.sin(current.angle);
    const nx = -dy * halfWidth;
    const ny = dx * halfWidth;
    const sx = current.x - dx * SOURCE_DISTANCE;
    const sy = current.y - dy * SOURCE_DISTANCE;
    const traces: Trace[][] = spectrum.map((_, i) => {
      const ior = glassIor(400 + (300 * i) / (WAVELENGTHS - 1));
      return Array.from({ length: BOUNDARIES }, (_, b) => {
        const offset = boundaryProfile(b);
        return traceRay(
          outline,
          sx + nx * offset,
          sy + ny * offset,
          dx,
          dy,
          ior,
          MAX_HITS,
        );
      });
    });
    // Incoming white light: identical for every wavelength until it lands.
    const reference = traces[WAVELENGTHS >> 1];
    {
      const mid = reference[(BOUNDARIES - 1) >> 1].points;
      field.sx = mid[0];
      field.sy = mid[1];
      field.ex = mid.length > 2 ? mid[2] : mid[0] + dx * SOURCE_DISTANCE * 2;
      field.ey = mid.length > 2 ? mid[3] : mid[1] + dy * SOURCE_DISTANCE * 2;
      field.dx = dx;
      field.dy = dy;
      field.fan = false;
    }
    const whiteEnergy = 2.4;
    for (let b = 0; b < BOUNDARIES - 1; b++) {
      const r0 = reference[b];
      const r1 = reference[b + 1];
      const hit0 = r0.points.length > 2;
      const hit1 = r1.points.length > 2;
      if (hit0 !== hit1) continue;
      const end = (r: Trace, hit: boolean) =>
        hit
          ? [r.points[2], r.points[3]]
          : [
              r.points[0] + dx * SOURCE_DISTANCE * 2,
              r.points[1] + dy * SOURCE_DISTANCE * 2,
            ];
      const [e0x, e0y] = end(r0, hit0);
      const [e1x, e1y] = end(r1, hit1);
      if (hit0 && !close(e0x, e0y, e1x, e1y)) continue;
      const p0 = boundaryProfile(b);
      const p1 = boundaryProfile(b + 1);
      quad(
        [r0.points[0], r0.points[1], white, whiteEnergy, p0, 0],
        [r1.points[0], r1.points[1], white, whiteEnergy, p1, 0],
        [e0x, e0y, white, whiteEnergy, p0, 0],
        [e1x, e1y, white, whiteEnergy, p1, 0],
      );
    }
    // Light inside and between the strokes: one strip per wavelength.
    const stripEnergy = whiteEnergy / WAVELENGTHS;
    traces.forEach((rays, i) => {
      const rgb = spectrum[i];
      for (let b = 0; b < BOUNDARIES - 1; b++) {
        const r0 = rays[b].points;
        const r1 = rays[b + 1].points;
        const p0 = boundaryProfile(b);
        const p1 = boundaryProfile(b + 1);
        const segments = Math.min(r0.length, r1.length) / 2 - 2;
        for (let k = 1; k <= segments; k++) {
          const a = k * 2;
          const z = a + 2;
          if (
            !close(r0[a], r0[a + 1], r1[a], r1[a + 1]) ||
            !close(r0[z], r0[z + 1], r1[z], r1[z + 1])
          )
            break;
          quad(
            [r0[a], r0[a + 1], rgb, stripEnergy, p0, 0],
            [r1[a], r1[a + 1], rgb, stripEnergy, p1, 0],
            [r0[z], r0[z + 1], rgb, stripEnergy, p0, 0],
            [r1[z], r1[z + 1], rgb, stripEnergy, p1, 0],
          );
        }
      }
    });
    // The dispersed exit. Curved strokes act as lenses and wavelengths can
    // take different internal paths, both of which would shred a physical fan
    // into stripes and slivers. Like light leaving a flat prism face, the fan
    // leaves from the reference wavelength's exit, collimated along the centre
    // ray, with violet bent furthest in the direction the light was deviated.
    const centre = reference[(BOUNDARIES - 1) >> 1];
    if (centre.escaped && centre.points.length > 2) {
      const exit = Math.atan2(centre.dy, centre.dx);
      const wrap = (angle: number) =>
        Math.atan2(Math.sin(angle), Math.cos(angle));
      const violet = traces[0][(BOUNDARIES - 1) >> 1];
      const red = traces[WAVELENGTHS - 1][(BOUNDARIES - 1) >> 1];
      const natural =
        violet.escaped &&
        red.escaped &&
        violet.points.length === red.points.length
          ? wrap(Math.atan2(violet.dy, violet.dx) - Math.atan2(red.dy, red.dx))
          : 0;
      const deviation = wrap(exit - current.angle);
      const sign =
        Math.sign(Math.abs(natural) > 0.002 ? natural : deviation) || 1;
      Object.assign(field, {
        fan: true,
        fx: centre.points[centre.points.length - 2],
        fy: centre.points[centre.points.length - 1],
        exit,
        sign,
      });
      const fanDirection = spectrum.map((_, i) => {
        const angle = exit + sign * (0.5 - i / (WAVELENGTHS - 1)) * FAN_SPREAD;
        return [Math.cos(angle), Math.sin(angle)];
      });
      const fanEnergy = 1.5 / BOUNDARIES;
      for (let b = 0; b < BOUNDARIES; b++) {
        const ray = reference[b];
        if (!ray.escaped || ray.points.length < 4) continue;
        const n = ray.points.length;
        const x = ray.points[n - 2];
        const y = ray.points[n - 1];
        if (
          !close(
            x,
            y,
            centre.points[centre.points.length - 2],
            centre.points[centre.points.length - 1],
          )
        )
          continue;
        const p = boundaryProfile(b);
        for (let i = 0; i < WAVELENGTHS - 1; i++) {
          const d0 = fanDirection[i];
          const d1 = fanDirection[i + 1];
          quad(
            [x, y, spectrum[i], fanEnergy, p, 0],
            [x, y, spectrum[i + 1], fanEnergy, p, 0],
            [
              x + d0[0] * FAN_LENGTH,
              y + d0[1] * FAN_LENGTH,
              spectrum[i],
              fanEnergy,
              p,
              FAN_LENGTH,
            ],
            [
              x + d1[0] * FAN_LENGTH,
              y + d1[1] * FAN_LENGTH,
              spectrum[i + 1],
              fanEnergy,
              p,
              FAN_LENGTH,
            ],
          );
        }
      }
    }
    geometry.setDrawRange(0, cursor);
    for (const attr of [position, color, profile, travel]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, cursor * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  rebuild();

  return {
    sheet,
    /** 0 = dark, 1 = fully on. */
    get reveal() {
      return reveal.value;
    },
    set reveal(value: number) {
      reveal.value = value;
    },
    /** Light arriving at a point of the plane, in linear RGB. */
    sample(x: number, y: number, out: number[]) {
      out[0] = out[1] = out[2] = 0;
      // A broad glow around the incoming beam, like a blurred light buffer.
      const vx = x - field.sx;
      const vy = y - field.sy;
      const along = vx * field.dx + vy * field.dy;
      const length = Math.hypot(field.ex - field.sx, field.ey - field.sy);
      if (along > 0 && along < length) {
        const across = (vx * -field.dy + vy * field.dx) / (halfWidth * 3);
        const glow = Math.exp(-across * across);
        out[0] += glow;
        out[1] += glow;
        out[2] += glow;
      }
      if (!field.fan) return out;
      const fx = x - field.fx;
      const fy = y - field.fy;
      const distance = Math.hypot(fx, fy);
      const relative = Math.atan2(
        Math.sin(Math.atan2(fy, fx) - field.exit),
        Math.cos(Math.atan2(fy, fx) - field.exit),
      );
      const u = 0.5 - (relative * field.sign) / FAN_SPREAD;
      const edge = Math.min(
        1,
        Math.max(0, Math.min(u + 0.08, 1.08 - u) / 0.16),
      );
      if (edge <= 0) return out;
      const rgb =
        spectrum[Math.round(Math.min(1, Math.max(0, u)) * (WAVELENGTHS - 1))];
      const energy = (edge * 1.4) / (1 + distance * 0.3) ** 1.5;
      out[0] += rgb[0] * energy;
      out[1] += rgb[1] * energy;
      out[2] += rgb[2] * energy;
      return out;
    },
    aim(next: Partial<LightAim>) {
      Object.assign(target, next);
    },
    /** Eases the light toward its aim; re-traces only while it moves. */
    update(dt = Infinity) {
      const blend = 1 - Math.exp(-7 * dt);
      let moved = false;
      for (const key of ["angle", "x", "y"] as const) {
        const delta = target[key] - current[key];
        if (Math.abs(delta) < 1e-5 || blend >= 1) {
          if (current[key] !== target[key]) moved = true;
          current[key] = target[key];
        } else {
          current[key] += delta * blend;
          moved = true;
        }
      }
      if (moved) rebuild();
    },
    get settling() {
      return (
        current.angle !== target.angle ||
        current.x !== target.x ||
        current.y !== target.y
      );
    },
    dispose() {
      plane.remove(sheet);
      geometry.dispose();
      material.dispose();
    },
  };
}
