// Figura isométrica: cómo funciona la liga UCTenis.
//   node figuras/liga/build.mjs          → liga-figura.html (tema oscuro)
//   node figuras/liga/build.mjs --light  → liga-figura-light.html
//
// El objeto: una mesa-cancha con un carrusel de 8 asientos (método del círculo:
// el asiento 1 queda fijo, el resto avanza uno por fecha; cada asiento juega
// con el que tiene al frente, al otro lado de la red; el asiento vacío es la
// fecha libre) y, detrás, un ábaco de fichas: cada partido suma 3 fichas al
// ganador y 1 al perdedor (0 por no presentarse). Las luces del ábaco marcan
// a los que hoy clasifican al Torneo de Maestros.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.agents/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../.agents/skills/anatomy/scripts/inline-kit.mjs";
import { buildModel } from "./model.mjs";
import { narration as script } from "./narration.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const M = buildModel();

const WIDTH = 640;
const HEIGHT = 430;

// ── Mundo ────────────────────────────────────────────────────────────────
const PLATE = { x: -206, y: -108, w: 344, d: 194, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// Mesa-cancha con el carrusel.
const TABLE = { x: -194, y: -38, w: 250, d: 100, r: 6 };
const TABLE_H = 8;
const CY = 12;                 // eje del carrusel (y)
const R = 28;                  // radio de la curva del riel (y distancia a la red)
// Cuatro canchas lado a lado: en cada una se juega un partido de la fecha.
const C = [-164, -110, -56, -2];   // x del centro de cada cancha
const COURT_W = 40, COURT_L = 88;  // dobles, en proporción a una cancha real
const Y_FAR = CY - R, Y_NEAR = CY + R;
const SLOTS = [
  [C[0], Y_FAR],                                  // 0: asiento fijo
  [C[1], Y_FAR], [C[2], Y_FAR], [C[3], Y_FAR],    // 1–3: fondo
  [C[3], Y_NEAR], [C[2], Y_NEAR], [C[1], Y_NEAR], // 4–6: frente
  [C[0], Y_NEAR],                                 // 7: frente de la cancha 1
];
// Curva del riel que vuelve del asiento 7 al 1 pasando entre las canchas 1 y 2.
const BEZ = [[C[0], Y_NEAR], [C[0] + 30, Y_NEAR], [C[1] - 30, Y_FAR], [C[1], Y_FAR]];
const bez = (u) => { const v = 1 - u; return [0, 1].map((k) => v * v * v * BEZ[0][k] + 3 * v * v * u * BEZ[1][k] + 3 * v * u * u * BEZ[2][k] + u * u * u * BEZ[3][k]); };
const NET_Z = TABLE_H;
const NET_H = 6;
const PUCK_Z = TABLE_H + 2;
const PUCK_H = 5;

// Ábaco de puntos.
const RACK = { x: -52, y: -100, w: 152, d: 24, r: 3 };
const RACK_H = 6;
const COL_Y = RACK.y + 10;
const COL_X = M.names.map((_, i) => -39 + i * 21.5);
const SOCKET_H = 3;
const CHIP_R = 6.4;
const CHIP_H = 3;
const CHIP_Z = RACK_H + SOCKET_H;
const RAIL_Z = CHIP_Z + M.maxPts * CHIP_H + 5;
const LAMP_Y = RACK.y + RACK.d - 4.5;

// Contador de fechas con manivela.
const BOX = { x: 66, y: -8, w: 56, d: 22, r: 2.5 };
const BOX_H = 18;
const CRANK = [BOX.x + BOX.w - 11, BOX.y + 10];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [RACK.x, RACK.y, RAIL_Z + 4], [RACK.x + RACK.w, RACK.y, RAIL_Z + 4]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth2 = ([x, y]) => k.depthOf([x, y, 0], P);
const byDepth = (pts) => [...pts].sort((a, b) => depth2(a) - depth2(b));

// ── Base ─────────────────────────────────────────────────────────────────
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Regla del frente: una marca por fecha de la temporada.
  const strip = { x: -176, y: PLATE.y + PLATE.d - 14, w: 290, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + strip.w - 6, 4.8, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.5, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2.5, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // Placa con el nombre, al costado derecho.
  const tag = { x: 76, y: 46, w: 46, d: 24, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + 5, tag.y + 9], 0.8, P, "x"), "LIGA 2026", { size: 4.4, tone: "mid" }));
  for (const y of [tag.y + 13.5, tag.y + 16.5, tag.y + 19.5]) {
    out.push(`<path class="iso-line" data-tone="faint" data-free="both" d="${k.lineOnTop([tag.x + 5, y], [tag.x + (y > tag.y + 18 ? 26 : 38), y], 0.8, P)}"/>`);
  }
  out.push(D(k.corners(tag, 2.4).map(([x, y]) => at([x, y, 0.8])), { size: 0.4 }));
  return out.join("");
}

// ── Mesa con cuatro canchas ──────────────────────────────────────────────
function trackPts() {
  const pts = [];
  const line = (p, q, n) => { for (let i = 0; i < n; i++) pts.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]); };
  line(SLOTS[1], SLOTS[3], 20);
  for (let i = 0; i < 24; i++) { const t = -Math.PI / 2 + Math.PI * i / 24; pts.push([C[3] + Math.cos(t) * R, CY + Math.sin(t) * R]); }
  line(SLOTS[4], SLOTS[7], 30);
  for (let i = 0; i < 20; i++) pts.push(bez(i / 20));
  return pts;
}
function offsetLoop(pts, d) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [p[0] - ty / l * d, p[1] + tx / l * d];
  });
}
const courtLine = (d) => `<path class="lg-court-line" d="${d}"/>`;
function court(cx) {
  const h = COURT_W / 2, l = COURT_L / 2, single = h - 5, service = 23.7;
  const plan = { x: cx - h, y: CY - l, w: COURT_W, d: COURT_L, r: 0.2 };
  const out = [`<path class="lg-court" d="${k.planOutline({ x: cx - h - 3, y: CY - l - 4, w: COURT_W + 6, d: COURT_L + 8, r: 1 }, TABLE_H, P, 2)}"/>`];
  const lines = [k.planOutline(plan, TABLE_H, P, 1)];
  for (const x of [cx - single, cx + single]) lines.push(k.lineOnTop([x, CY - l], [x, CY + l], TABLE_H, P));
  for (const y of [CY - service, CY + service]) lines.push(k.lineOnTop([cx - single, y], [cx + single, y], TABLE_H, P));
  lines.push(k.lineOnTop([cx, CY - service], [cx, CY + service], TABLE_H, P));
  lines.push(k.lineOnTop([cx, CY - l], [cx, CY - l + 2], TABLE_H, P), k.lineOnTop([cx, CY + l], [cx, CY + l - 2], TABLE_H, P));
  out.push(courtLine(lines.join("")));
  return out.join("");
}
function table() {
  const out = [`<path class="iso-halo" d="${k.haloOf(TABLE, 0, TABLE_H, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(TABLE, 0, TABLE_H, P, 6, 1), { tone: "mid" }));
  out.push(`<path class="lg-court-out" d="${k.planOutline(k.insetPlan(TABLE, 2), TABLE_H, P, 6)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(TABLE, 2), TABLE_H, P, 6), { tone: "lo" }));
  out.push(D(k.corners(TABLE, 5).map(([x, y]) => at([x, y, TABLE_H])), { size: 0.45 }));
  C.forEach((cx) => out.push(court(cx)));
  // Riel del carrusel: ranura doble que recorre los asientos 1→7.
  const loop = trackPts();
  out.push(L(k.onTop(offsetLoop(loop, -3), TABLE_H, P, true) + k.onTop(offsetLoop(loop, 3), TABLE_H, P, true), { tone: "faint" }));
  // Asiento fijo: placa propia (no está en el riel).
  const [fx, fy] = SLOTS[0];
  out.push(S(k.cylinder(fx, fy, 11.6, TABLE_H, 0.8, P, 32, 0.3), { tone: "mid" }));
  out.push(D([at([fx - 10, fy, TABLE_H + 0.8]), at([fx + 10, fy, TABLE_H + 0.8])], { size: 0.4 }));
  // Motor del carrusel (a la derecha), con su eje.
  const pod = { x: C[3] + R + 6, y: CY - 9, w: 12, d: 18, r: 2 };
  out.push(S(k.slabOf(pod, TABLE_H, 9, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(pod, 2), TABLE_H + 9, P, 3), { tone: "faint" }));
  out.push(S(k.cylinder(pod.x + 6, CY, 2.4, TABLE_H + 9, 2, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(pod.x + 6, CY, 2.4, TABLE_H + 9, TABLE_H + 11, 14, P), { tone: "lo" }));
  return out.join("");
}

// Una red por cancha: postes fuera de las líneas de dobles, malla y faja blanca.
function nets() {
  const out = [];
  for (const cx of C) {
    const x0 = cx - COURT_W / 2 - 2, x1 = cx + COURT_W / 2 + 2;
    out.push(S(k.cylinder(x0, CY, 1.2, NET_Z, NET_H + 1.2, P, 14), { tone: "mid" }));
    const mesh = { x: x0 + 1.2, y: CY - 0.5, w: x1 - x0 - 2.4, d: 1, r: 0.2 };
    out.push(S(k.slabOf(mesh, NET_Z + 0.6, NET_H - 0.6, P, 1), { tone: "lo", crease: "none" }));
    const lines = [];
    for (let x = mesh.x + 2.5; x < mesh.x + mesh.w - 1; x += 2.5) lines.push(k.segment([x, CY + 0.5, NET_Z + 0.6], [x, CY + 0.5, NET_Z + NET_H - 1.1], P));
    out.push(L(lines.join(""), { tone: "faint" }));
    out.push(S(k.slabOf({ x: mesh.x, y: CY - 0.7, w: mesh.w, d: 1.4, r: 0.3 }, NET_Z + NET_H - 1.1, 1.1, P, 1), { tone: "hi", crease: "none" }));
    out.push(S(k.cylinder(x1, CY, 1.2, NET_Z, NET_H + 1.2, P, 14), { tone: "mid" }));
  }
  return out.join("");
}

// ── Ábaco ────────────────────────────────────────────────────────────────
function rackBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(RACK, 0, RACK_H, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(RACK, 0, RACK_H, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.lineOnTop([RACK.x + 0.8, LAMP_Y - 4.5], [RACK.x + RACK.w - 0.8, LAMP_Y - 4.5], RACK_H, P), { tone: "faint" }));
  // Números de columna en el frente del ábaco.
  M.names.forEach((_, i) => {
    out.push(k.faceTextSvg(k.sideMatrix([COL_X[i], RACK.y + RACK.d], RACK_H - 1.4, P, "left"), String(i + 1), { size: 3.6, tone: "mid", anchor: "middle" }));
  });
  // Postes laterales del marco.
  for (const x of [RACK.x + 3, RACK.x + RACK.w - 7]) {
    out.push(S(k.slabOf({ x, y: COL_Y - 2, w: 4, d: 4, r: 0.8 }, RACK_H, RAIL_Z - RACK_H, P, 2, 0.3), { tone: "mid" }));
  }
  return out.join("");
}
function rackRail() {
  const rail = { x: RACK.x + 2, y: COL_Y - 3, w: RACK.w - 4, d: 6, r: 1.5 };
  const out = [S(k.slabOf(rail, RAIL_Z, 4, P, 3, 0.5), { tone: "mid" })];
  out.push(D(COL_X.map((x) => at([x, COL_Y, RAIL_Z + 4])), { size: 0.45 }));
  return out.join("");
}

// Una columna del ábaco (se rehace en la página cuando cambia).
function columnSvg(x, settled, falling) {
  const out = [];
  out.push(S(k.cylinder(x, COL_Y, 7.4, RACK_H, SOCKET_H, P, 32, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, COL_Y, 1.1, CHIP_Z, RAIL_Z - CHIP_Z, P, 12), { tone: "mid", crease: "none" }));
  if (settled > 0) {
    const top = CHIP_Z + settled * CHIP_H;
    out.push(S(k.cylinder(x, COL_Y, CHIP_R, CHIP_Z, settled * CHIP_H, P, 36, 0.3), { tone: "hi", crease: "lo" }));
    const seams = [];
    for (let i = 1; i < settled; i++) seams.push(k.sideArc(x, COL_Y, CHIP_R, CHIP_Z + i * CHIP_H, P, 24));
    if (seams.length) out.push(L(seams.join(""), { tone: "lo" }));
    out.push(L(k.ring(x, COL_Y, CHIP_R - 1.6, top, P, 28), { tone: "faint" }));
    out.push(S(k.cylinder(x, COL_Y, 1.1, top, 0.01, P, 12), { tone: "mid", crease: "none" }));
  }
  for (const z of falling) {
    out.push(S(k.cylinder(x, COL_Y, CHIP_R, z, CHIP_H, P, 36, 0.3), { tone: "hi", lit: true }));
    out.push(L(k.ring(x, COL_Y, CHIP_R - 1.6, z + CHIP_H, P, 28), { tone: "lo" }));
  }
  return out.join("");
}
function lampSvg(x, on) {
  return S(k.cylinder(x, LAMP_Y, 2.4, RACK_H, 0.8, P, 20), { tone: "mid" }) +
    S(k.cylinder(x, LAMP_Y, 1.6, RACK_H + 0.8, 1.2, P, 20), on ? { tone: "hi", lit: true } : { tone: "lo" });
}

// ── Contador de fechas ───────────────────────────────────────────────────
function counter() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, BOX_H, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(BOX, 0, BOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, 4, P, 4), { tone: "lo" }) }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 2.4), BOX_H, P, 3), { tone: "faint" }));
  // Ventana del contador en la cara frontal (+y).
  const win = [[BOX.x + 4, BOX.y + BOX.d, BOX_H - 4], [BOX.x + 30, BOX.y + BOX.d, BOX_H - 4], [BOX.x + 30, BOX.y + BOX.d, 7], [BOX.x + 4, BOX.y + BOX.d, 7]];
  out.push(`<path class="iso-solid-face" data-tone="lo" d="${k.pathOf(win.map(at), true)}" style="fill:var(--anatomy-shade-0)"/>`);
  out.push(L(k.pathOf(win.map(at), true), { tone: "mid" }));
  out.push(`<g data-part="counter">${counterText(0)}</g>`);
  out.push(D([at([BOX.x + 36, BOX.y + BOX.d, BOX_H - 5]), at([BOX.x + 46, BOX.y + BOX.d, BOX_H - 5]), at([BOX.x + 36, BOX.y + BOX.d, 9]), at([BOX.x + 46, BOX.y + BOX.d, 9])], { size: 0.45 }));
  // Manivela sobre la tapa.
  out.push(S(k.cylinder(CRANK[0], CRANK[1], 5, BOX_H, 2.4, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(CRANK[0], CRANK[1], 5, BOX_H, BOX_H + 2.4, 28, P), { tone: "lo" }));
  out.push(`<g data-part="crank">${crankArm(0)}</g>`);
  return out.join("");
}
function counterText(fecha) {
  const text = fecha ? `${String(fecha).padStart(2, "0")}/${String(M.totalFechas).padStart(2, "0")}` : `00/${String(M.totalFechas).padStart(2, "0")}`;
  return k.faceTextSvg(k.sideMatrix([BOX.x + 6.5, BOX.y + BOX.d], 9.6, P, "left"), text, { size: 5.6, tone: "hi" });
}
function crankArm(turn) {
  const a = turn * Math.PI * 2;
  const [cx, cy] = CRANK;
  const tip = [cx + Math.sin(a) * 9, cy - Math.cos(a) * 9];
  const z = BOX_H + 2.4;
  return S(k.slabOf({ x: Math.min(cx, tip[0]) - 1.2, y: Math.min(cy, tip[1]) - 1.2, w: Math.abs(tip[0] - cx) + 2.4, d: Math.abs(tip[1] - cy) + 2.4, r: 1.1 }, z, 1.4, P, 2), { tone: "mid" }) +
    S(k.cylinder(tip[0], tip[1], 1.6, z + 1.4, 5, P, 16), { tone: "hi" });
}

// Cable del contador al motor del carrusel.
function cable() {
  const y = CY + 4, pod = C[3] + R + 18;
  const from = at([BOX.x, BOX.y + 11, 5]);
  const to = at([pod, y, TABLE_H + 4]);
  const via = [at([BOX.x - 8, BOX.y + 11, 0.6]), at([TABLE.x + TABLE.w + 8, y, 0.6]), at([TABLE.x + TABLE.w + 0.2, y, 0.6]), at([TABLE.x + TABLE.w + 0.2, y, TABLE_H]), at([pod + 4, y, TABLE_H])];
  return k.wireSvg(from, to, { via, tone: "lo", size: 1 });
}

// ── Escena estática + grupos vivos ───────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Máquina de la liga: una mesa-cancha con un carrusel de ocho asientos y, detrás, un ábaco de fichas. El asiento uno queda fijo y los demás avanzan un lugar por fecha; cada asiento juega con el que tiene al otro lado de la red y el asiento vacío es la fecha libre. Cada partido suma tres fichas al ganador y una al perdedor; las luces marcan a los cuatro que hoy van al Torneo de Maestros.",
  body: [
    plate(),
    rackBack(),
    ...COL_X.map((x, i) => `<g data-col="${i}">${columnSvg(x, 0, [])}</g>`),
    rackRail(),
    ...COL_X.map((x, i) => `<g data-lamp="${i}">${lampSvg(x, false)}</g>`),
    cable(),
    counter(),
    table(),
    `<g data-part="far"></g>`,
    nets(),
    `<g data-part="near"></g>`,
    `<g data-part="bars"></g>`,
  ],
});

// ── Página viva ──────────────────────────────────────────────────────────
const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(M)};
const SLOTS = ${JSON.stringify(SLOTS)};
const C = ${JSON.stringify(C)}, R = ${R}, CY = ${CY}, BEZ = ${JSON.stringify(BEZ)};
const bez = ${bez.toString()};
const COL_X = ${JSON.stringify(COL_X)}, COL_Y = ${COL_Y}, CHIP_Z = ${CHIP_Z}, CHIP_H = ${CHIP_H}, CHIP_R = ${CHIP_R}, RAIL_Z = ${RAIL_Z};
const RACK_H = ${RACK_H}, SOCKET_H = ${SOCKET_H}, LAMP_Y = ${LAMP_Y}, TABLE_H = ${TABLE_H}, PUCK_Z = ${PUCK_Z}, PUCK_H = ${PUCK_H};
const BOX = ${JSON.stringify(BOX)}, BOX_H = ${BOX_H}, CRANK = ${JSON.stringify(CRANK)};
${columnSvg.toString().replace(/k\./g, "")}
${lampSvg.toString().replace(/k\./g, "")}
${crankArm.toString().replace(/k\./g, "")}
const S = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const D = (points, style) => dotsSvg(points, style);
const at = (p) => iso(p, P);
function counterText(fecha) {
  const pad = (n) => String(n).padStart(2, "0");
  return faceTextSvg(sideMatrix([BOX.x + 6.5, BOX.y + BOX.d], 9.6, P, "left"), pad(fecha) + "/" + pad(M.totalFechas), { size: 5.6, tone: "hi" });
}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const G = { far: $('[data-part="far"]'), near: $('[data-part="near"]'), bars: $('[data-part="bars"]'), counter: $('[data-part="counter"]'), crank: $('[data-part="crank"]') };
const cols = COL_X.map((_, i) => $('[data-col="' + i + '"]'));
const lamps = COL_X.map((_, i) => $('[data-lamp="' + i + '"]'));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = SLOTS.length;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Recorrido de un asiento s al siguiente (s ≥ 1), con u en [0, 1].
function along(s, u) {
  const arc = (cx, a0, a1) => { const t = a0 + (a1 - a0) * u; return [cx + Math.cos(t) * R, CY + Math.sin(t) * R]; };
  const lerp = (p, q) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  if (s === 3) return arc(C[3], -Math.PI / 2, Math.PI / 2);
  if (s === 7) return bez(u);
  return lerp(SLOTS[s], SLOTS[s + 1]);
}

// Peloteo: la pelota cruza la red tres veces entre los dos jugadores, con
// su sombra en la cancha. u va de 0 a 1 durante el peloteo.
function rally(sa, sb, u, offset) {
  const p = SLOTS[sa], q = SLOTS[sb];
  const dy = q[1] - p[1], sign = Math.sign(dy) || 1;
  const from = [p[0] + 4, p[1] + sign * 9], to = [q[0] - 4, q[1] - sign * 9];
  const phase = Math.min(2.999, Math.max(0, u * 3));
  const seg = Math.floor(phase), w = phase - seg;
  const [a, c] = seg % 2 ? [to, from] : [from, to];
  const x = a[0] + (c[0] - a[0]) * w, y = a[1] + (c[1] - a[1]) * w;
  const z = PUCK_Z + PUCK_H + 3 + 16 * Math.sin(Math.PI * w);
  const r = 3.6 * P.scale;
  const [sx, sy] = at([x, y, TABLE_H]);
  const [bx, by] = at([x, y, z]);
  const fade = Math.min(1, u * 8, (1 - u) * 8);
  return '<g style="opacity:' + fade.toFixed(2) + '"><ellipse class="lg-ball-shadow" cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" rx="' + (r * 0.95).toFixed(1) + '" ry="' + (r * 0.5).toFixed(1) + '"/>' +
    '<circle class="lg-ball" cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="' + r.toFixed(1) + '"/>' +
    '<path class="lg-ball-seam" d="M' + (bx - r * 0.75).toFixed(1) + ' ' + (by - r * 0.62).toFixed(1) + 'Q' + (bx - r * 0.1).toFixed(1) + ' ' + by.toFixed(1) + ' ' + (bx - r * 0.75).toFixed(1) + ' ' + (by + r * 0.62).toFixed(1) +
    'M' + (bx + r * 0.75).toFixed(1) + ' ' + (by - r * 0.62).toFixed(1) + 'Q' + (bx + r * 0.1).toFixed(1) + ' ' + by.toFixed(1) + ' ' + (bx + r * 0.75).toFixed(1) + ' ' + (by + r * 0.62).toFixed(1) + '"/></g>';
}

// Ficha de jugador (o asiento vacío) en la mesa.
function puck(x, y, who, glow) {
  const out = [S(cylinder(x, y, 10.4, TABLE_H, 2, P, 32, 0.3), { tone: "lo" })];
  if (who < 0) {
    out.push(L(ring(x, y, 7.2, TABLE_H + 2, P, 28), { tone: "lo" }));
    out.push(L(ring(x, y, 2.4, TABLE_H + 2, P, 20), { tone: "faint" }));
    return out.join("");
  }
  out.push(S(cylinder(x, y, 8.2, PUCK_Z, PUCK_H, P, 32, 0.6), { tone: "hi", crease: "lo", lit: glow }));
  out.push(L(sideArc(x, y, 8.2, PUCK_Z + 1.6, P, 24), { tone: "lo" }));
  out.push(faceTextSvg(topMatrix([x, y + 2.2], PUCK_Z + PUCK_H, P, "x"), String(who + 1), { size: 6.4, tone: "hi", anchor: "middle" }));
  return out.join("");
}

// Estado: fecha mostrada f (0 = antes de empezar) y reloj de la animación.
let f = 0, t = 99, frame = 0, last = 0, visible = false, touring = !still.matches, idle = 0, hold = 0;
const T_MOVE = 0.8, T_BARS = 1.2, T_DROP = 0.85; // T_BARS: peloteo
const T_END = T_MOVE + T_BARS + T_DROP;

function ptsBefore(fecha) { return fecha > 1 ? M.rounds[fecha - 2].pts : M.names.map(() => 0); }

function draw() {
  const round = f ? M.rounds[f - 1] : null;
  const prevRing = f > 1 ? M.rounds[f - 2].ring : null;
  const ring = round ? round.ring : M.rounds[0].ring;
  const move = ease(clamp01(t / T_MOVE));
  const bars = clamp01((t - T_MOVE) / T_BARS);
  const drop = clamp01((t - T_MOVE - T_BARS) / T_DROP);
  const playing = new Set(round && bars > 0 ? round.matches.flatMap((m) => m.kind === "wo_doble" ? [] : [m.a, m.b]) : []);

  // Carrusel.
  const far = [], near = [];
  for (let s = 0; s < N; s++) {
    const who = ring[s];
    let p = SLOTS[s];
    if (s > 0 && prevRing && move < 1) p = along(s === 1 ? 7 : s - 1, move);
    const item = { p, svg: puck(p[0], p[1], who, false), d: depthOf([p[0], p[1], 0], P) };
    (p[1] < CY ? far : near).push(item);
  }
  const html = (list) => list.sort((a, b) => a.d - b.d).map((i) => i.svg).join("");
  G.far.innerHTML = html(far); G.near.innerHTML = html(near);

  // Barras de cada cruce, por encima de la red.
  let b = "";
  if (round && bars > 0) {
    const z = PUCK_Z + PUCK_H + 0.4;
    // Punto en el borde de la ficha, hacia el rival (no tapa el número).
    const rim = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * 5.6, p[1] + dy / l * 5.6, z]; };
    const bar = (sa, sb, style) => {
      const p = SLOTS[sa], q = SLOTS[sb];
      const a = rim(p, q), c = rim(q, p);
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, z + 7];
      return '<g style="opacity:' + bars.toFixed(2) + '">' + wireSvg(at(a), at(c), { via: [at(mid)], size: 1.1, ...style }) + "</g>";
    };
    for (const m of round.matches) {
      if (m.kind !== "jugado") { b += bar(m.slots[0], m.slots[1], { tone: m.kind === "wo_doble" ? "mid" : "lit", dashed: true }); continue; }
      if (bars < 1) b += rally(m.slots[0], m.slots[1], (t - T_MOVE) / T_BARS, m.slots[0] * 0.13);
    }
    const byeSlot = round.ring.indexOf(round.bye);
    if (byeSlot >= 0) b += bar(byeSlot, N - 1 - byeSlot, { tone: "lo", dotted: true, ends: "from" });
  }
  G.bars.innerHTML = b;

  // Ábaco: fichas asentadas + fichas que caen en esta fecha.
  const before = ptsBefore(f);
  const after = round ? round.pts : before;
  COL_X.forEach((x, i) => {
    const gain = after[i] - before[i];
    const falling = [];
    for (let c = 0; c < gain; c++) {
      const u = ease(clamp01(drop * 1.6 - c * 0.22));
      if (u <= 0) continue;
      const rest = CHIP_Z + (before[i] + c) * CHIP_H;
      const from = RAIL_Z - CHIP_H - 1;
      falling.push(rest + (from - rest) * (1 - u));
    }
    const key = before[i] + ":" + falling.map((z) => z.toFixed(1)).join(",");
    if (cols[i].dataset.key !== key) { cols[i].dataset.key = key; cols[i].innerHTML = columnSvg(x, before[i], falling); }
  });

  // Luces: los que hoy clasifican al Maestros (tras caer las fichas).
  const lit = new Set(round && drop >= 1 ? round.order.slice(0, M.masters) : (f > 1 ? M.rounds[f - 2].order.slice(0, M.masters) : []));
  lamps.forEach((g, i) => { const on = lit.has(i) ? "1" : "0"; if (g.dataset.on !== on) { g.dataset.on = on; g.innerHTML = lampSvg(COL_X[i], on === "1"); } });

  // Contador y manivela.
  if (G.counter.dataset.f !== String(f)) { G.counter.dataset.f = String(f); G.counter.innerHTML = counterText(f); }
  G.crank.innerHTML = crankArm((f - 1 + move) * 0.25);

  // Lectura.
  let text = "7 jugadores · " + M.totalFechas + " fechas · " + M.masters + " al Maestros";
  if (round) {
    const name = (i) => M.names[i];
    if (drop >= 1) {
      const lead = round.order[0];
      text = f === M.totalFechas
        ? "Al Maestros: " + round.order.slice(0, M.masters).map(name).join(", ")
        : "Fecha " + f + " · lidera " + name(lead) + " con " + round.pts[lead] + " pts";
      const special = round.matches.find((m) => m.kind !== "jugado");
      if (special && f !== M.totalFechas) text += special.kind === "wo" ? " · W.O.: " + name(special.winner) + " +3" : " · W.O. doble: 0 y 0";
    } else {
      text = "Fecha " + f + " · " + round.ventana + " · libre: " + name(round.bye);
    }
  }
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(f));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (t < T_END) t = still.matches ? T_END : t + dt;
  else if (touring) {
    hold += dt;
    const wait = f === M.totalFechas ? 4.5 : f === 0 ? 1 : 1.6;
    if (hold > wait) { hold = 0; advance(); }
  }
  draw();
  frame = visible && (touring || t < T_END) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function advance() { if (f === M.totalFechas) { f = 0; t = 99; } else { f += 1; t = 0; } hold = 0; }
function go(step) {
  touring = false; clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; hold = 0; run(); }, 6000);
  if (step > 0) advance(); else { f = Math.max(0, f - 1); t = 99; }
  draw(); run();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", () => { stopGuide(); go(1); });
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); stopGuide(); go(1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); stopGuide(); go(-1); }
  if (e.key === "Home") { e.preventDefault(); stopGuide(); touring = false; f = 0; t = 99; draw(); }
});

// ── Explicación guiada: audio grabado + subtítulos ─────────────────────
// Si existen los audios de cada frase (figuras/liga/audio/), se reproducen
// en orden y cada uno mueve la figura al empezar. Sin audios, usa la voz del
// navegador; sin voz (o con la voz apagada), corre solo con subtítulos.
const CUES = ${JSON.stringify(script(M).map(({ voz, ...c }) => c))};
const subs = document.querySelector("[data-subs]");
const button = document.querySelector("[data-narrate]");
const optVoice = document.querySelector("[data-opt=voz]");
const optSubs = document.querySelector("[data-opt=subs]");
const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
const HAS_AUDIO = CUES.every((c) => c.audio);
const player = HAS_AUDIO ? new Audio() : null;
if (player) { player.preload = "auto"; player.src = CUES[0].audio; }
let guide = null;
const LABEL = button.textContent;
const STEP = 1.15; // segundos entre fechas cuando una frase recorre varias
function pickVoice() {
  const voices = synth ? synth.getVoices() : [];
  const es = voices.filter((v) => /^es([-_]|$)/i.test(v.lang));
  const natural = es.filter((v) => /natural|neural|online|premium|enhanced|google/i.test(v.name));
  for (const list of [natural, es]) {
    for (const pref of ["es-CL", "es-419", "es-US", "es-MX", "es-AR", "es-ES"]) {
      const hit = list.find((v) => v.lang.replace("_", "-").toLowerCase() === pref.toLowerCase());
      if (hit) return hit;
    }
  }
  return es[0] || null;
}
if (synth) { synth.getVoices(); synth.addEventListener?.("voiceschanged", () => synth.getVoices()); }
function showSubs(text) {
  subs.textContent = text;
  subs.hidden = !text || !optSubs.checked;
}
function showFecha(n) {
  if (n === f) return;
  f = n; t = n ? 0 : 99; hold = 0; draw(); run();
}
function cue(i) {
  if (!guide) return;
  guide.i = i;
  clearInterval(guide.stepper);
  const steps = CUES[i].fechas;
  let k = 0;
  showFecha(steps[0]);
  // Con audio, las fechas se reparten en lo que dura la frase.
  const step = guide.dur > 0 ? Math.min(STEP, (guide.dur - 0.2) / steps.length) : STEP;
  if (steps.length > 1) guide.stepper = setInterval(() => { k += 1; if (k < steps.length) showFecha(steps[k]); else clearInterval(guide.stepper); }, step * 1000);
  showSubs(CUES[i].text);
}
const duration = (c) => Math.max(2600, c.text.split(/\\s+/).length * 330 + 700, c.fechas.length * STEP * 1000 + 600);
function timed(i) {
  if (!guide) return;
  cue(i);
  guide.timer = setTimeout(() => (i + 1 < CUES.length ? timed(i + 1) : endGuide()), duration(CUES[i]));
}
function playAudio(i, token) {
  if (!guide || guide.token !== token) return;
  player.onplaying = () => { if (guide && guide.token === token && guide.i !== i) { guide.dur = isFinite(player.duration) ? player.duration : 0; cue(i); } };
  player.onended = () => { if (guide && guide.token === token) (i + 1 < CUES.length ? playAudio(i + 1, token) : endGuide()); };
  player.onerror = () => { if (guide && guide.token === token) timed(i); };
  if (!player.src.endsWith(CUES[i].audio)) player.src = CUES[i].audio;
  player.currentTime = 0;
  player.play().catch(() => { if (guide && guide.token === token) timed(i); });
}
function startGuide() {
  stopGuide();
  touring = false; clearTimeout(idle);
  f = 0; t = 99; draw();
  const token = {};
  guide = { i: -1, token, timer: 0, stepper: 0, dur: 0 };
  button.textContent = "■ Detener";
  button.setAttribute("aria-pressed", "true");
  if (!optVoice.checked) { timed(0); return; }
  if (player) { playAudio(0, token); return; }
  if (!synth) { timed(0); return; }
  const voice = pickVoice();
  synth.cancel();
  CUES.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c.text);
    u.lang = voice ? voice.lang : "es-CL";
    if (voice) u.voice = voice;
    u.rate = 1.1;
    u.onstart = () => { if (guide && guide.token === token) cue(i); };
    u.onend = () => { if (i === CUES.length - 1 && guide && guide.token === token) endGuide(); };
    u.onerror = (e) => {
      if (!guide || guide.token !== token || e.error === "interrupted" || e.error === "canceled") return;
      synth.cancel(); timed(Math.max(0, i));
    };
    synth.speak(u);
  });
  // Si a los 2,5 s no empezó a hablar, no hay voz usable: solo subtítulos.
  guide.timer = setTimeout(() => { if (guide && guide.token === token && guide.i < 0) { synth.cancel(); timed(0); } }, 2500);
}
function silence() {
  if (player) { player.onplaying = player.onended = player.onerror = null; player.pause(); }
  if (synth) synth.cancel();
}
function endGuide() {
  if (!guide) return;
  clearTimeout(guide.timer); clearInterval(guide.stepper);
  guide = null;
  button.textContent = LABEL;
  button.setAttribute("aria-pressed", "false");
  setTimeout(() => { if (!guide) showSubs(""); }, 2200);
  idle = setTimeout(() => { touring = !still.matches; hold = 0; run(); }, 8000);
}
function stopGuide() {
  if (!guide) return;
  clearTimeout(guide.timer); clearInterval(guide.stepper);
  guide = null;
  silence();
  showSubs("");
  button.textContent = LABEL;
  button.setAttribute("aria-pressed", "false");
}
button.addEventListener("click", () => (guide ? stopGuide() : startGuide()));
optSubs.addEventListener("change", () => { subs.hidden = !subs.textContent || !optSubs.checked; });
optVoice.addEventListener("change", () => {
  // Apagar la voz a mitad sigue con subtítulos desde la misma frase.
  if (guide && !optVoice.checked) { const i = Math.max(0, guide.i); clearTimeout(guide.timer); guide.token = {}; silence(); timed(i); }
});
addEventListener("pagehide", silence);
draw();
`;


const NARR_CSS = `<style>
body.iso{--court:#1d3a30;--court-out:#14241d;--court-line:#c4d6cc;--ball:#d8e63c;--ball-seam:#f6fae2}
body.iso[data-theme="light"]{--court:#78a888;--court-out:#a8c8b2;--court-line:#ffffff;--ball:#cfe02a;--ball-seam:#ffffff}
.lg-court{fill:var(--court)}.lg-court-out{fill:var(--court-out)}
.lg-court-line{fill:none;stroke:var(--court-line);stroke-width:.8;stroke-linecap:round}
.lg-ball{fill:var(--ball);stroke:rgba(0,0,0,.35);stroke-width:.5}.lg-ball-seam{fill:none;stroke:var(--ball-seam);stroke-width:.7;stroke-linecap:round}
.lg-ball-shadow{fill:#000;opacity:.3}
.lg-subs{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:7px 14px;border-radius:8px;background:rgba(0,0,0,.8);color:#fff;font:500 15px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.35)}
.lg-subs[hidden]{display:none}
.lg-narr{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:12px;color:var(--anatomy-text);font-size:13px}
.lg-narr button{font:inherit;font-weight:700;padding:9px 16px;border-radius:999px;border:1px solid var(--anatomy-mid);background:var(--anatomy-card);color:var(--anatomy-strong);cursor:pointer}
.lg-narr button:hover{border-color:var(--anatomy-hi)}
.lg-narr button[aria-pressed="true"]{border-color:var(--anatomy-lit)}
.lg-narr label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.lg-narr input{accent-color:var(--anatomy-lit);width:16px;height:16px;margin:0}
@media (max-width:520px){.lg-subs{bottom:40px;font-size:14px;max-width:calc(100% - 16px)}}
</style>`;
const NARR_CONTROLS = `<div class="lg-narr" role="group" aria-label="Explicación guiada"><button type="button" data-narrate aria-pressed="false">▶ Escuchar la explicación</button><label><input type="checkbox" data-opt="voz" checked> Voz</label><label><input type="checkbox" data-opt="subs" checked> Subtítulos</label></div>`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Cómo funciona la liga",
  hint: "Toca o → para avanzar la fecha",
  readout: `7 jugadores · ${M.totalFechas} fechas · ${M.masters} al Maestros`,
  keys: [
    { mark: "raised", label: "Cada ficha numerada es un jugador; cada partido de la fecha se juega en su cancha, contra quien está al otro lado de la red" },
    { mark: "lit", label: "Puntos de la fecha: 3 al ganador, 1 al perdedor, 0 si no se presenta" },
  ],
  caption:
    `Un ejemplo con 7 jugadores del club. En cada fecha (unos 10 días) el jugador 1 se queda en su lugar y los demás avanzan un asiento por el carrusel; como son impares, hay un asiento vacío y quien queda frente a él tiene fecha libre. En ${M.totalFechas} fechas todos juegan contra todos una vez. Si un partido no se juega dentro del plazo es W.O. doble y nadie suma. El ábaco ordena por puntos (si dos empatan, manda el partido entre ellos) y las luces marcan a los ${M.masters} que van al Torneo de Maestros (6 desde 8 jugadores, 8 desde 12). Nombres y resultados inventados; el fixture y las reglas son los de la liga.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Máquina de la liga: flechas para avanzar o retroceder fechas" aria-valuemin="0" aria-valuemax="${M.totalFechas}" aria-valuenow="0">${svg}</div><div class="lg-subs" data-subs aria-live="polite" hidden></div>`,
}).replace("<figcaption", NARR_CONTROLS + "<figcaption");

// --embed: versión para el iframe de liga.html, con la paleta del sitio
// (verde cancha nocturna, acento amarillo pelota) y altura informada al padre.
const embed = process.argv.includes("--embed");
const EMBED_CSS = `<style>
body.iso{--anatomy-page:transparent;--anatomy-card:#0b1914;--anatomy-paper:#0b1914;--anatomy-face:#10221b;--anatomy-top:#11241c;
--anatomy-shade-0:#08130f;--anatomy-shade-1:#0a1813;--anatomy-shade-2:#0c1c16;--anatomy-shade-3:#0e2019;
--anatomy-lit-top:#26300c;--anatomy-lit-shade:#1c240a;--anatomy-text:#9bb0a6;--anatomy-strong:#f4f8f5;--anatomy-muted:#6c8479;
--anatomy-hi:#cfdcd5;--anatomy-mid:#5d7669;--anatomy-lo:#33473d;--anatomy-faint:#1f3129;--anatomy-lit:#d4e31a;
--anatomy-halo:#020604;--anatomy-dot:#e2ebe6;background:transparent}
body.iso .iso-page{width:100%;max-width:760px;margin:0 auto}
body.iso{--court:#1f5c46;--court-out:#123a2d;--court-line:#e6f1ea}
body.iso .iso-plate{border-radius:16px;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
body.iso .iso-stage:focus:not(:focus-visible){outline:none}
body.iso .lg-narr button{background:#c6d300;border-color:#c6d300;color:#0a1712}
body.iso .lg-narr button[aria-pressed="true"]{background:transparent;color:#e2f03a}
@media (max-width:520px){body.iso .iso-plate{padding:44px 10px}body.iso .iso-plate-corner[data-corner="title"]{display:none}}
</style>`;
const EMBED_JS = `
const report = () => parent.postMessage({ type: "uct-figura", height: Math.ceil(document.documentElement.getBoundingClientRect().height) }, "*");
new ResizeObserver(report).observe(document.documentElement);
addEventListener("load", report);
// liga.html avisa cuando oculta la figura (cambio de pestaña): se calla.
addEventListener("message", (e) => { if (e.source === parent && e.data && e.data.type === "uct-figura-stop") stopGuide(); });
`;
const file = embed ? "liga-figura-embed.html" : theme === "light" ? "liga-figura-light.html" : "liga-figura.html";
let html = k.pageHtml({ title: "Cómo funciona la liga", theme: embed ? "dark" : theme, body, script: kitScript() + live + (embed ? EMBED_JS : "") }).replace('<html lang="en">', '<html lang="es">');
html = html.replace("</head>", NARR_CSS + (embed ? EMBED_CSS : "") + "</head>");
writeFileSync(join(HERE, file), html);
console.log("wrote", file);
