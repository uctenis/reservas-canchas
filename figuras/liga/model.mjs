// Modelo de la figura: una liga de ejemplo de 7 inscritos jugada con las
// reglas reales de liga.js (fixture por el método del círculo, 3/1/0 puntos,
// ventanas de fechas de la temporada 2026, cupos al Torneo de Maestros).
// Los resultados son inventados pero deterministas; todo lo demás sale del
// código del club.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const League = require("../../liga.js");

export const SEASON = League.getSeason("2026");
export const POINTS = SEASON.puntos; // { victoria: 3, derrota: 1, noPresentacion: 0 }

// Inscritos en orden de siembra (fuerza solo para inventar resultados).
export const PLAYERS = [
  { key: "ana", nombre: "Ana", fuerza: 9 },
  { key: "bruno", nombre: "Bruno", fuerza: 7 },
  { key: "carla", nombre: "Carla", fuerza: 8 },
  { key: "diego", nombre: "Diego", fuerza: 5 },
  { key: "elena", nombre: "Elena", fuerza: 6 },
  { key: "felipe", nombre: "Felipe", fuerza: 4 },
  { key: "gabi", nombre: "Gabi", fuerza: 3 },
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const short = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

// Generador pseudoaleatorio con semilla, para que la figura sea siempre igual.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function buildModel() {
  const entrants = PLAYERS.map((p, i) => ({ ...p, numero: i + 1 }));
  const rounds = League.buildRoundRobin(entrants);
  const n = entrants.length + (entrants.length % 2); // 8 asientos (uno vacío = fecha libre)
  const seats = [...entrants.map((_, i) => i), ...(entrants.length % 2 ? [-1] : [])];
  const random = rng(2026);

  // Asiento de cada jugador en la fecha r: el 0 queda fijo y el resto avanza
  // un asiento por fecha (exactamente lo que hace buildRoundRobin).
  const slotsAt = (r) => {
    const ring = [seats[0]];
    for (let s = 1; s < n; s++) ring.push(seats[1 + ((((s - 1 - r) % (n - 1)) + (n - 1)) % (n - 1))]);
    return ring; // ring[slot] = índice del jugador (-1 = asiento vacío)
  };

  const rows = entrants.map((e) => ({ i: e.numero - 1, nombre: e.nombre, pts: 0, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, gf: 0, gc: 0, woP: 0 }));
  const h2h = new Map();
  const out = [];

  rounds.forEach((round, r) => {
    const ring = slotsAt(r);
    // Comprueba que los cruces del dibujo son los de liga.js.
    const drawn = [];
    for (let s = 0; s < n / 2; s++) {
      const a = ring[s], b = ring[n - 1 - s];
      if (a >= 0 && b >= 0) drawn.push([a, b].sort().join("-"));
    }
    const real = round.pairs.map(([a, b]) => [a.numero - 1, b.numero - 1].sort().join("-"));
    if (drawn.sort().join() !== real.sort().join()) throw new Error(`fecha ${r + 1}: cruces distintos a liga.js`);

    const window = League.getRoundWindow(SEASON, r + 1);
    const matches = [];
    for (let s = 0; s < n / 2; s++) {
      const slotA = s, slotB = n - 1 - s;
      const a = ring[slotA], b = ring[slotB];
      if (a < 0 || b < 0) continue;
      const A = entrants[a], B = entrants[b];
      let kind = "jugado";
      // Dos casos de las bases para que se vean en la figura.
      if (r === 3 && matches.length === 0) kind = "wo";      // fecha 4: uno no se presenta
      if (r === 5 && matches.length === 2) kind = "wo_doble"; // fecha 6: no se jugó en plazo
      const aWins = random() < A.fuerza / (A.fuerza + B.fuerza);
      const winner = aWins ? a : b, loser = aWins ? b : a;
      let score = "", gained = {};
      if (kind === "wo_doble") {
        gained = { [a]: POINTS.noPresentacion, [b]: POINTS.noPresentacion };
        rows[a].pj++; rows[b].pj++; rows[a].woP++; rows[b].woP++;
      } else if (kind === "wo") {
        gained = { [winner]: POINTS.victoria, [loser]: POINTS.noPresentacion };
        rows[winner].pts += POINTS.victoria; rows[winner].pg++; rows[winner].pj++;
        rows[loser].pp++; rows[loser].pj++; rows[loser].woP++;
        h2h.set([winner, loser].sort().join("-"), winner);
        score = "W.O.";
      } else {
        const third = random() < 0.35;
        const set = () => { const l = Math.floor(random() * 5); return [6, l]; };
        const sets = third ? [set(), [Math.floor(random() * 5), 6], [7, 6]] : [set(), set()];
        score = sets.map(([w, l]) => `${w}-${l}`).join(", ");
        const gw = sets.reduce((t, [w]) => t + w, 0), gl = sets.reduce((t, [, l]) => t + l, 0);
        rows[winner].pts += POINTS.victoria; rows[loser].pts += POINTS.derrota;
        rows[winner].pg++; rows[loser].pp++; rows[winner].pj++; rows[loser].pj++;
        rows[winner].sf += 2; rows[winner].sc += third ? 1 : 0; rows[loser].sf += third ? 1 : 0; rows[loser].sc += 2;
        rows[winner].gf += gw; rows[winner].gc += gl; rows[loser].gf += gl; rows[loser].gc += gw;
        gained = { [winner]: POINTS.victoria, [loser]: POINTS.derrota };
        h2h.set([winner, loser].sort().join("-"), winner);
      }
      matches.push({ slots: [slotA, slotB], a, b, kind, winner: kind === "wo_doble" ? -1 : winner, gained, score });
    }
    const bye = round.bye ? round.bye.numero - 1 : -1;
    const standings = sortStandings(rows, h2h);
    out.push({
      fecha: r + 1,
      ventana: `${short(window.start)} – ${short(window.end)}`,
      ring,
      bye,
      matches,
      pts: rows.map((row) => row.pts),
      order: standings.map((row) => row.i),
    });
  });

  return {
    names: entrants.map((e) => e.nombre),
    rounds: out,
    masters: League.mastersSize(entrants.length),
    totalFechas: rounds.length,
    maxPts: (rounds.length - 1) * POINTS.victoria,
  };
}

// Desempate de las bases (igual que sortStandings de liga.js): puntos; si
// empatan exactamente dos, el partido entre ellos; luego partidos ganados,
// diferencia de sets, de games, W.O. perdidos y nombre.
function sortStandings(rows, h2h) {
  const sorted = rows.slice().sort((a, b) => b.pts - a.pts || b.pg - a.pg || (b.sf - b.sc) - (a.sf - a.sc) ||
    (b.gf - b.gc) - (a.gf - a.gc) || a.woP - b.woP || a.nombre.localeCompare(b.nombre, "es"));
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].pts === sorted[i].pts) j++;
    if (j === i + 1) {
      const w = h2h.get([sorted[i].i, sorted[j].i].sort().join("-"));
      if (w === sorted[j].i) [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
    i = j;
  }
  return sorted;
}
