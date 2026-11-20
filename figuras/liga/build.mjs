// Figura isométrica: cómo funciona la liga de tenis UCTenis.
//   node figuras/liga/build.mjs          → liga-figura.html (tema oscuro)
//   node figuras/liga/build.mjs --light  → liga-figura-light.html
//   node figuras/liga/build.mjs --embed  → liga-figura-embed.html (iframe de liga.html)
//
// La escena: cuatro canchas de tenis lado a lado. En cada fecha los jugadores
// caminan a su cancha (método del círculo: el jugador del asiento 1 se queda
// y el resto avanza un lugar), pelotean contra quien tienen al otro lado de la
// red y la tabla de posiciones bajo las canchas suma 3 al ganador y 1 al
// perdedor. Con inscritos impares un asiento queda vacío: ese jugador descansa.
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
const HEIGHT = 330;

// ── Mundo ────────────────────────────────────────────────────────────────
const C = [-81, -27, 27, 81];      // x del centro de cada cancha
const COURT_W = 40, COURT_L = 88;  // dobles, en proporción a una cancha real
const R = 28;                      // distancia de los jugadores a la red
const Y_FAR = -R, Y_NEAR = R;
const TABLE = { x: -118, y: -56, w: 240, d: 112, r: 6 };
const TABLE_H = 6;
const PLATE = { x: -128, y: -66, w: 260, d: 146, r: 8 };
const PLATE_H = 8, FOOT_H = 4;
const NET_H = 6;
const SLOTS = [
  [C[0], Y_FAR],                                  // 0: asiento fijo
  [C[1], Y_FAR], [C[2], Y_FAR], [C[3], Y_FAR],    // 1–3: fondo
  [C[3], Y_NEAR], [C[2], Y_NEAR], [C[1], Y_NEAR], // 4–6: frente
  [C[0], Y_NEAR],                                 // 7: frente de la cancha 1
];
// Camino del jugador que vuelve del asiento 7 al 1 (entre las canchas 1 y 2).
const BEZ = [[C[0], Y_NEAR], [C[0] + 30, Y_NEAR], [C[1] - 30, Y_FAR], [C[1], Y_FAR]];
const bez = (u) => { const v = 1 - u; return [0, 1].map((k) => v * v * v * BEZ[0][k] + 3 * v * v * u * BEZ[1][k] + 3 * v * u * u * BEZ[2][k] + u * u * u * BEZ[3][k]); };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [TABLE.x, TABLE.y, 34], [TABLE.x + TABLE.w, TABLE.y, 34]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 66 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── Base y canchas ───────────────────────────────────────────────────────
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 6, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  const screws = k.corners(PLATE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Placa del club al frente.
  const tag = { x: 64, y: PLATE.y + PLATE.d - 21, w: 50, d: 15, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3, 0.3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([tag.x + 4.5, tag.y + 9.5], 0.8, P, "x"), "LIGA UCTENIS", { size: 4.6, tone: "mid" }));
  out.push(D(k.corners(tag, 2.2).map(([x, y]) => at([x, y, 0.8])), { size: 0.4 }));
  return out.join("");
}
const courtLine = (d) => `<path class="lg-court-line" d="${d}"/>`;
function court(cx) {
  const h = COURT_W / 2, l = COURT_L / 2, single = h - 5, service = 23.7;
  const plan = { x: cx - h, y: -l, w: COURT_W, d: COURT_L, r: 0.2 };
  const out = [`<path class="lg-court" d="${k.planOutline({ x: cx - h - 3, y: -l - 4, w: COURT_W + 6, d: COURT_L + 8, r: 1 }, TABLE_H, P, 2)}"/>`];
  const lines = [k.planOutline(plan, TABLE_H, P, 1)];
  for (const x of [cx - single, cx + single]) lines.push(k.lineOnTop([x, -l], [x, l], TABLE_H, P));
  for (const y of [-service, service]) lines.push(k.lineOnTop([cx - single, y], [cx + single, y], TABLE_H, P));
  lines.push(k.lineOnTop([cx, -service], [cx, service], TABLE_H, P));
  lines.push(k.lineOnTop([cx, -l], [cx, -l + 2], TABLE_H, P), k.lineOnTop([cx, l], [cx, l - 2], TABLE_H, P));
  out.push(courtLine(lines.join("")));
  // Número de cancha pintado en el fondo, fuera de la línea.
  out.push(k.faceTextSvg(k.topMatrix([cx, -l - 0.6], TABLE_H, P, "x"), String(C.indexOf(cx) + 1), { size: 3.6, tone: "mid", anchor: "middle" }));
  return out.join("");
}
function table() {
  const out = [`<path class="iso-halo" d="${k.haloOf(TABLE, 0, TABLE_H, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(TABLE, 0, TABLE_H, P, 6, 1), { tone: "mid" }));
  out.push(`<path class="lg-court-out" d="${k.planOutline(k.insetPlan(TABLE, 1.5), TABLE_H, P, 6)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(TABLE, 1.5), TABLE_H, P, 6), { tone: "lo" }));
  C.forEach((cx) => out.push(court(cx)));
  return out.join("");
}
// Una red por cancha: postes fuera de las líneas de dobles, malla y faja blanca.
function nets() {
  const out = [];
  for (const cx of C) {
    const x0 = cx - COURT_W / 2 - 2, x1 = cx + COURT_W / 2 + 2;
    out.push(S(k.cylinder(x0, 0, 1.2, TABLE_H, NET_H + 1.2, P, 14), { tone: "mid" }));
    const mesh = { x: x0 + 1.2, y: -0.5, w: x1 - x0 - 2.4, d: 1, r: 0.2 };
    out.push(S(k.slabOf(mesh, TABLE_H + 0.6, NET_H - 0.6, P, 1), { tone: "lo", crease: "none" }));
    const lines = [];
    for (let x = mesh.x + 2.5; x < mesh.x + mesh.w - 1; x += 2.5) lines.push(k.segment([x, 0.5, TABLE_H + 0.6], [x, 0.5, TABLE_H + NET_H - 1.1], P));
    out.push(L(lines.join(""), { tone: "faint" }));
    out.push(S(k.slabOf({ x: mesh.x, y: -0.7, w: mesh.w, d: 1.4, r: 0.3 }, TABLE_H + NET_H - 1.1, 1.1, P, 1), { tone: "hi", crease: "none" }));
    out.push(S(k.cylinder(x1, 0, 1.2, TABLE_H, NET_H + 1.2, P, 14), { tone: "mid" }));
  }
  return out.join("");
}

// ── Jugador de tenis (se dibuja en la página) ────────────────────────────
// Base con su nombre, piernas, short, polera, cabeza y raqueta en la mano
// derecha. `won` ilumina la polera del ganador de la fecha.
function tennisPlayer(x, y, name, won, resting) {
  const k = 1.35; // escala del jugador
  const z = TABLE_H;
  const out = [];
  out.push(S(cylinder(x, y, 8.6 * k, z, 1.1, P, 32, 0.3), { tone: "lo" }));
  out.push(faceTextSvg(topMatrix([x, y + 6.3 * k], z + 1.1, P, "x"), name, { size: 3.4 * k, tone: "hi", anchor: "middle" }));
  const z0 = z + 1.1;
  for (const dx of [-1.5 * k, 1.5 * k]) out.push(S(cylinder(x + dx, y, 1.05 * k, z0, 5.4 * k, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(cylinder(x, y, 2.8 * k, z0 + 5.4 * k, 2 * k, P, 20), { tone: "mid" }));
  out.push(S(cylinder(x, y, 3 * k, z0 + 7.4 * k, 5.4 * k, P, 24, 0.5), { tone: "hi", crease: "lo", lit: won }));
  out.push(S(cylinder(x, y, 2.1 * k, z0 + 12.8 * k, 3.4 * k, P, 20, 0.6), { tone: "hi", crease: "lo" }));
  // Brazo y raqueta.
  const shoulder = [x + 2.6 * k, y, z0 + 11.8 * k], hand = [x + 4.4 * k, y, z0 + 9.4 * k], tip = [x + 5.2 * k, y, z0 + 13.6 * k];
  out.push(`<path class="iso-line" data-tone="hi" data-free="both" d="${segment(shoulder, hand, P)}" style="stroke-width:1.6"/>`);
  out.push(`<path class="iso-line" data-tone="hi" data-free="both" d="${segment(hand, tip, P)}" style="stroke-width:1.1"/>`);
  const head = [x + 5.6 * k, y, z0 + 16.2 * k];
  out.push(`<path class="lg-racket" d="${sideRing(head, 2.7 * k, "y", P, 24)}"/>`);
  out.push(`<path class="lg-racket-str" d="${segment([head[0] - 1.6 * k, y, head[2]], [head[0] + 1.6 * k, y, head[2]], P)}${segment([head[0], y, head[2] - 2 * k], [head[0], y, head[2] + 2 * k], P)}"/>`);
  return `<g${resting ? ' style="opacity:.4"' : ""}>${out.join("")}</g>`;
}

// ── Escena estática + grupos vivos ───────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Cuatro canchas de tenis del club. En cada fecha los jugadores van a su cancha y juegan contra quien tienen al otro lado de la red; con jugadores impares, uno descansa. Una tabla de posiciones bajo las canchas suma tres puntos al ganador y uno al perdedor.",
  body: [plate(), table(), `<g data-part="far"></g>`, nets(), `<g data-part="near"></g>`, `<g data-part="balls"></g>`],
});

// ── Página viva ──────────────────────────────────────────────────────────
const live = `
const P = ${JSON.stringify(P)};
const M = ${JSON.stringify(M)};
const SLOTS = ${JSON.stringify(SLOTS)};
const C = ${JSON.stringify(C)}, R = ${R}, TABLE_H = ${TABLE_H}, BEZ = ${JSON.stringify(BEZ)};
const bez = ${bez.toString()};
${tennisPlayer.toString()}
const S = (paths, style) => solidSvg(paths, style);
const at = (p) => iso(p, P);

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const G = { far: $('[data-part="far"]'), near: $('[data-part="near"]'), balls: $('[data-part="balls"]') };
const board = document.querySelector("[data-board]");
const boardHead = document.querySelector("[data-board-head]");
const rows = M.names.map((_, i) => board.querySelector('[data-row="' + i + '"]'));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const N = SLOTS.length;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Camino de un asiento s al siguiente (s ≥ 1), con u en [0, 1].
function along(s, u) {
  if (s === 3) { const t = -Math.PI / 2 + Math.PI * u; return [C[3] + Math.cos(t) * R, Math.sin(t) * R]; }
  if (s === 7) return bez(u);
  const p = SLOTS[s], q = SLOTS[s + 1];
  return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
}

// Peloteo: la pelota va de raqueta a raqueta, cruza la red tres veces.
function rally(sa, sb, u) {
  const p = SLOTS[sa], q = SLOTS[sb];
  const z = TABLE_H + 1.1 + 21;
  const from = [p[0] + 7.6, p[1] + (q[1] > p[1] ? 8 : -8)], to = [q[0] + 7.6, q[1] + (p[1] > q[1] ? 8 : -8)];
  const phase = Math.min(2.999, Math.max(0, u * 3));
  const seg = Math.floor(phase), w = phase - seg;
  const [a, c] = seg % 2 ? [to, from] : [from, to];
  const x = a[0] + (c[0] - a[0]) * w, y = a[1] + (c[1] - a[1]) * w;
  const h = z + 10 * Math.sin(Math.PI * w);
  const r = 2.4 * P.scale;
  const [sx, sy] = at([x, y, TABLE_H]);
  const [bx, by] = at([x, y, h]);
  const fade = Math.min(1, u * 10, (1 - u) * 10);
  const f1 = (v) => v.toFixed(1);
  return '<g style="opacity:' + fade.toFixed(2) + '"><ellipse class="lg-ball-shadow" cx="' + f1(sx) + '" cy="' + f1(sy) + '" rx="' + f1(r * 0.95) + '" ry="' + f1(r * 0.5) + '"/>' +
    '<circle class="lg-ball" cx="' + f1(bx) + '" cy="' + f1(by) + '" r="' + f1(r) + '"/>' +
    '<path class="lg-ball-seam" d="M' + f1(bx - r * 0.75) + ' ' + f1(by - r * 0.62) + 'Q' + f1(bx - r * 0.1) + ' ' + f1(by) + ' ' + f1(bx - r * 0.75) + ' ' + f1(by + r * 0.62) +
    'M' + f1(bx + r * 0.75) + ' ' + f1(by - r * 0.62) + 'Q' + f1(bx + r * 0.1) + ' ' + f1(by) + ' ' + f1(bx + r * 0.75) + ' ' + f1(by + r * 0.62) + '"/></g>';
}

// Estado: fecha mostrada f (0 = antes de empezar) y reloj de la animación.
let f = 0, t = 99, frame = 0, last = 0, visible = false, touring = !still.matches, idle = 0, hold = 0;
const T_MOVE = 0.9, T_RALLY = 1.5, T_SCORE = 0.6;
const T_END = T_MOVE + T_RALLY + T_SCORE;

// Tabla de posiciones (HTML bajo las canchas). Se reordena al terminar los
// partidos de la fecha y muestra lo que sumó cada uno.
function renderBoard(fecha, scored) {
  const round = fecha ? M.rounds[fecha - 1] : null;
  const shown = round && scored ? round : fecha > 1 ? M.rounds[fecha - 2] : null;
  const pts = shown ? shown.pts : M.names.map(() => 0);
  const order = shown ? shown.order : M.names.map((_, i) => i).sort((a, b) => M.names[a].localeCompare(M.names[b], "es"));
  const before = fecha > 1 ? M.rounds[fecha - 2].pts : M.names.map(() => 0);
  order.forEach((i, pos) => {
    const row = rows[i];
    row.style.top = (pos * 30 + (pos >= M.masters ? 22 : 0)) + "px";
    row.querySelector("[data-pos]").textContent = pos + 1;
    row.querySelector("[data-pts]").textContent = pts[i];
    let tag = "";
    if (round && scored) {
      const m = round.matches.find((x) => x.a === i || x.b === i);
      if (round.bye === i) tag = "descansa";
      else if (m && m.kind === "wo_doble") tag = "W.O. doble · 0";
      else if (m && m.kind === "wo") tag = m.winner === i ? "+3 W.O." : "W.O. · 0";
      else tag = "+" + (round.pts[i] - before[i]);
    }
    const badge = row.querySelector("[data-tag]");
    badge.textContent = tag;
    badge.dataset.kind = tag.startsWith("+3") ? "win" : tag.startsWith("+1") ? "loss" : tag ? "zero" : "";
    row.classList.toggle("is-masters", !!shown && pos < M.masters);
  });
  board.classList.toggle("has-masters", !!shown);
  const head = fecha ? "Fecha " + fecha + " de " + M.totalFechas + " · " + round.ventana : "Antes de empezar · " + M.names.length + " jugadores inscritos";
  if (boardHead.textContent !== head) boardHead.textContent = head;
}

function draw() {
  const round = f ? M.rounds[f - 1] : null;
  const prevRing = f > 1 ? M.rounds[f - 2].ring : null;
  const ring = round ? round.ring : M.rounds[0].ring;
  const move = ease(clamp01(t / T_MOVE));
  const rallyU = clamp01((t - T_MOVE) / T_RALLY);
  const scored = !!round && t >= T_MOVE + T_RALLY;
  const winners = new Set(scored ? round.matches.filter((m) => m.winner >= 0).map((m) => m.winner) : []);

  // Jugadores, ordenados por profundidad; los del fondo van detrás de las redes.
  const far = [], near = [];
  for (let s = 0; s < N; s++) {
    const who = ring[s];
    if (who < 0) continue;
    let p = SLOTS[s];
    if (s > 0 && prevRing && move < 1) p = along(s === 1 ? 7 : s - 1, move);
    const item = { svg: tennisPlayer(p[0], p[1], M.names[who], winners.has(who), !!round && round.bye === who), d: depthOf([p[0], p[1], 0], P) };
    (p[1] < 0 ? far : near).push(item);
  }
  const html = (list) => list.sort((a, b) => a.d - b.d).map((i) => i.svg).join("");
  G.far.innerHTML = html(far); G.near.innerHTML = html(near);

  // Peloteos (solo partidos jugados) y W.O. como línea discontinua.
  let b = "";
  if (round && t >= T_MOVE) {
    for (const m of round.matches) {
      if (m.kind === "jugado") { if (rallyU < 1) b += rally(m.slots[0], m.slots[1], rallyU); continue; }
      const [p, q] = m.slots.map((s) => SLOTS[s]);
      b += wireSvg(at([p[0], p[1] + (q[1] > p[1] ? 9 : -9), TABLE_H + 0.3]), at([q[0], q[1] + (p[1] > q[1] ? 9 : -9), TABLE_H + 0.3]), { tone: m.kind === "wo" ? "lit" : "mid", dashed: true, size: 1 });
    }
  }
  G.balls.innerHTML = b;

  // Tabla.
  const key = f + ":" + scored;
  if (board.dataset.key !== key) { board.dataset.key = key; renderBoard(f, scored); }

  // Lectura.
  let text = M.names.length + " jugadores · " + M.totalFechas + " fechas · " + M.masters + " al Maestros";
  if (round) {
    const name = (i) => M.names[i];
    if (!scored) text = "Fecha " + f + " · se juega · descansa " + name(round.bye);
    else if (f === M.totalFechas) text = "Al Maestros: " + round.order.slice(0, M.masters).map(name).join(", ");
    else text = "Fecha " + f + " · lidera " + name(round.order[0]) + " con " + round.pts[round.order[0]] + " pts";
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
    const wait = f === M.totalFechas ? 5 : f === 0 ? 1.2 : 2;
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

const BOARD_CSS = `<style>
body.iso{--court:#1d3a30;--court-out:#14241d;--court-line:#c4d6cc;--ball:#d8e63c;--ball-seam:#f6fae2;--win:#d8e63c}
body.iso[data-theme="light"]{--court:#78a888;--court-out:#a8c8b2;--court-line:#ffffff;--ball:#cfe02a;--ball-seam:#ffffff;--win:#6b7a00}
.lg-court{fill:var(--court)}.lg-court-out{fill:var(--court-out)}
.lg-court-line{fill:none;stroke:var(--court-line);stroke-width:.8;stroke-linecap:round}
.lg-ball{fill:var(--ball);stroke:rgba(0,0,0,.35);stroke-width:.5}.lg-ball-seam{fill:none;stroke:var(--ball-seam);stroke-width:.7;stroke-linecap:round}
.lg-ball-shadow{fill:#000;opacity:.3}
.lg-racket{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:.9}.lg-racket-str{fill:none;stroke:var(--anatomy-mid);stroke-width:.5}
.lg-board{margin-top:14px;border:1px solid var(--anatomy-faint);border-radius:12px;padding:12px 14px;background:var(--anatomy-card);font:500 14px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--anatomy-strong)}
.lg-board-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;margin-bottom:8px;color:var(--anatomy-text);font-size:12.5px}
.lg-board-top b{color:var(--anatomy-strong);font-size:13.5px}
.lg-rows{position:relative}
.lg-row{position:absolute;left:0;right:0;top:0;height:28px;display:grid;grid-template-columns:28px 1fr auto 44px;align-items:center;gap:8px;padding:0 8px;border-radius:8px;transition:top .6s cubic-bezier(.32,.72,0,1),background .3s}
.lg-row.is-masters{background:color-mix(in srgb,var(--win) 14%,transparent)}
.lg-row .lg-pos{color:var(--anatomy-muted);font-variant-numeric:tabular-nums;text-align:center}
.lg-row .lg-pts{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.lg-tag{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.lg-tag:empty{display:none}
.lg-tag[data-kind="win"]{background:var(--win);color:#10170a}
.lg-tag[data-kind="loss"]{border:1px solid var(--anatomy-mid);color:var(--anatomy-strong)}
.lg-tag[data-kind="zero"]{color:var(--anatomy-muted);border:1px dashed var(--anatomy-lo)}
.lg-cut{position:absolute;left:0;right:0;height:22px;display:flex;align-items:center;gap:8px;color:var(--win);font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:0;transition:opacity .3s}
.lg-cut::before,.lg-cut::after{content:"";flex:1;border-top:1px dashed currentColor;opacity:.6}
.lg-board.has-masters .lg-cut{opacity:1}
.lg-subs{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);padding:7px 14px;border-radius:8px;background:rgba(0,0,0,.8);color:#fff;font:500 15px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.35)}
.lg-subs[hidden]{display:none}
.lg-narr{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-top:12px;color:var(--anatomy-text);font-size:13px}
.lg-narr button{font:inherit;font-weight:700;padding:9px 16px;border-radius:999px;border:1px solid var(--anatomy-mid);background:var(--anatomy-card);color:var(--anatomy-strong);cursor:pointer}
.lg-narr button:hover{border-color:var(--anatomy-hi)}
.lg-narr button[aria-pressed="true"]{border-color:var(--anatomy-lit)}
.lg-narr label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.lg-narr input{accent-color:var(--anatomy-lit);width:16px;height:16px;margin:0}
@media (max-width:520px){.lg-subs{bottom:40px;font-size:14px;max-width:calc(100% - 16px)}.lg-board{padding:10px}}
</style>`;
const NARR_CONTROLS = `<div class="lg-narr" role="group" aria-label="Explicación guiada"><button type="button" data-narrate aria-pressed="false">▶ Escuchar la explicación</button><label><input type="checkbox" data-opt="voz" checked> Voz</label><label><input type="checkbox" data-opt="subs" checked> Subtítulos</label></div>`;
const BOARD = `<div class="lg-board" data-board aria-live="polite"><div class="lg-board-top"><b>Tabla de posiciones</b><span data-board-head>Antes de empezar</span></div><div class="lg-rows" style="height:${M.names.length * 30 + 22}px">${M.names
  .map((name, i) => `<div class="lg-row" data-row="${i}" style="top:${i * 30 + (i >= M.masters ? 22 : 0)}px"><span class="lg-pos" data-pos>${i + 1}</span><span>${name}</span><span class="lg-tag" data-tag></span><span class="lg-pts" data-pts>0</span></div>`)
  .join("")}<div class="lg-cut" style="top:${M.masters * 30}px">↑ clasifican al Torneo de Maestros</div></div></div>`;

const body = k.plateHtml({
  fig: "Liga UCTenis",
  title: "Cómo funciona la liga",
  hint: "Toca la cancha para avanzar",
  readout: `${M.names.length} jugadores · ${M.totalFechas} fechas · ${M.masters} al Maestros`,
  keys: [],
  caption: `Ejemplo con ${M.names.length} jugadores; nombres y resultados inventados. El orden de los partidos, los plazos y el puntaje son los de la liga real.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Canchas de la liga: flechas para avanzar o retroceder fechas" aria-valuemin="0" aria-valuemax="${M.totalFechas}" aria-valuenow="0">${svg}</div><div class="lg-subs" data-subs aria-live="polite" hidden></div>`,
}).replace("<figcaption", NARR_CONTROLS + BOARD + "<figcaption");

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
html = html.replace("</head>", BOARD_CSS + (embed ? EMBED_CSS : "") + "</head>");
writeFileSync(join(HERE, file), html);
console.log("wrote", file);
