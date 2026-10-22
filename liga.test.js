const assert = require('node:assert/strict');
const { calculateStandings, getCycle } = require('./liga.js');

const cycle = getCycle('2026-09-07');
const players = [
  { id: 'p1', nombre: 'Ana', genero: 'F' },
  { id: 'p2', nombre: 'Bea', genero: 'F' },
  { id: 'p3', nombre: 'Carla', genero: 'F' }
];
const matches = [
  { id: 'm1', tipo: 'liga', status: 'completado', fecha: cycle.start, retadorId: 'p1', retadorNombre: 'Ana', retadoId: 'p2', retadoNombre: 'Bea', ganadorId: 'p1', marcador: '6-3, 6-4' },
  { id: 'm2', tipo: 'liga', status: 'completado', fecha: cycle.start, retadorId: 'p1', retadorNombre: 'Ana', retadoId: 'p3', retadoNombre: 'Carla', ganadorId: 'p3', marcador: '6-4, 7-5' },
  { id: 'old', tipo: 'ranking', status: 'completado', fecha: cycle.start, retadorId: 'p1', retadoId: 'p2', ganadorId: 'p2', marcador: '6-0, 6-0' }
];

const standings = calculateStandings(players, matches, cycle);
assert.equal(standings[0].nombre, 'Ana');
assert.equal(standings[0].pts, 8);
assert.equal(standings[0].pj, 2);
assert.equal(standings[0].pg, 1);
assert.equal(standings[1].nombre, 'Carla');
assert.equal(standings[1].pts, 5);
assert.equal(standings[2].nombre, 'Bea');
assert.equal(standings[2].pts, 3);
assert.equal(standings.every(row => row.semanas <= 1), true);

// Revancha contra el mismo rival en el ciclo: no debe duplicar puntaje ni
// estadisticas, pero si debe seguir sumando a las semanas jugadas.
const rematchCycle = getCycle('2026-09-07');
const weekTwo = new Date(`${rematchCycle.start}T00:00:00Z`);
weekTwo.setUTCDate(weekTwo.getUTCDate() + 7);
const rematchMatches = [
  { id: 'r1', tipo: 'liga', status: 'completado', fecha: rematchCycle.start, retadorId: 'p1', retadorNombre: 'Ana', retadoId: 'p2', retadoNombre: 'Bea', ganadorId: 'p1', marcador: '6-3, 6-4' },
  { id: 'r2', tipo: 'liga', status: 'completado', fecha: weekTwo.toISOString().slice(0, 10), retadorId: 'p2', retadorNombre: 'Bea', retadoId: 'p1', retadoNombre: 'Ana', ganadorId: 'p1', marcador: '6-1, 6-1' }
];
const rematchStandings = calculateStandings(players.slice(0, 2), rematchMatches, rematchCycle);
const ana = rematchStandings.find(row => row.nombre === 'Ana');
const bea = rematchStandings.find(row => row.nombre === 'Bea');
assert.equal(ana.pj, 1);
assert.equal(ana.pts, 5);
assert.equal(bea.pj, 1);
assert.equal(bea.pts, 3);
assert.equal(ana.semanas, 2);
assert.equal(bea.semanas, 2);

console.log('liga.test.js: OK');
// ── Campeonato de Liga 2026 (bases oficiales) ──────────────────────────────
const L = require('./liga.js');
const season = L.getSeason('2026');
const enrolled = (id, nombre, extra = {}) => ({ id, nombre, email: `${id}@uct.cl`, genero: 'M', liga2026: { inscrito: true, inscritoEn: `2026-10-0${id.slice(1)}`, ...extra } });
const eight = Array.from({ length: 8 }, (_, i) => enrolled(`m${i + 1}`, `Jugador ${i + 1}`));

// Todos contra todos: 7 fechas, 4 partidos cada una, cada pareja una vez.
const rr = L.buildRoundRobin(L.getEntrants(eight, season, 'M'));
assert.equal(rr.length, 7);
assert.equal(rr.every(round => round.pairs.length === 4 && !round.bye), true);
const seen = new Set(rr.flatMap(round => round.pairs.map(([a, b]) => [a.key, b.key].sort().join('-'))));
assert.equal(seen.size, 28);

// Impar: N fechas y alguien libre en cada una.
const rrOdd = L.buildRoundRobin(L.getEntrants(eight.slice(0, 5), season, 'M'));
assert.equal(rrOdd.length, 5);
assert.equal(rrOdd.every(round => round.bye && round.pairs.length === 2), true);

// Ventanas oficiales y su continuación.
assert.deepEqual(L.getRoundWindow(season, 1), { start: '2026-11-01', end: '2026-11-10' });
assert.deepEqual(L.getRoundWindow(season, 9), { start: '2027-01-20', end: '2027-01-30' });
assert.deepEqual(L.getRoundWindow(season, 10), { start: '2027-02-01', end: '2027-02-10' });
assert.deepEqual(L.getRoundWindow(season, 12), { start: '2027-02-20', end: '2027-02-28' });

// Puntaje 3/1/0, W.O. simple y W.O. doble al vencer el plazo.
const four = eight.slice(0, 4);
const view0 = L.buildSeasonView(four, [], { season, gender: 'M', today: '2026-11-05' });
const [p1, p2] = view0.rounds[0].partidos;
const mk = (partido, extra) => ({ tipo: 'liga', ligaTemporada: '2026', fecha: '2026-11-04', retadorId: partido.a.id, retadorEmail: partido.a.email, retadorNombre: partido.a.nombre, retadoId: partido.b.id, retadoEmail: partido.b.email, retadoNombre: partido.b.nombre, ...extra });
const results = [
  mk(p1, { id: 'x1', status: 'completado', ganadorId: p1.a.id, marcador: '6-3, 4-6, 10-7' }),
  mk(p2, { id: 'x2', status: 'wo_retado' })
];
let view = L.buildSeasonView(four, results, { season, gender: 'M', today: '2026-11-12' });
const row = key => view.standings.find(r => r.key === key);
assert.equal(row(p1.a.key).pts, 3);
assert.equal(row(p1.b.key).pts, 1);
assert.equal(row(p1.a.key).setsFor, 2);
assert.equal(row(p1.a.key).gamesFor, 11); // 6 + 4 + 1 por el tie break
assert.equal(row(p2.a.key).pts, 3);
assert.equal(row(p2.b.key).pts, 0);
assert.equal(row(p2.b.key).woPerdidos, 1);
// Fecha 2 sin jugar y vencida al 21 de noviembre: W.O. doble.
view = L.buildSeasonView(four, results, { season, gender: 'M', today: '2026-11-21' });
assert.equal(view.rounds[1].partidos.every(p => p.state === 'wo_doble'), true);
assert.equal(view.rounds[2].partidos.every(p => p.state === 'por_agendar'), true);

// Resultado jugado fuera de plazo no cuenta, salvo excepción de la comisión.
const late = [mk(p1, { id: 'late', status: 'completado', fecha: '2026-11-15', ganadorId: p1.a.id, marcador: '6-0, 6-0' })];
view = L.buildSeasonView(four, late, { season, gender: 'M', today: '2026-11-16' });
assert.equal(view.rounds[0].partidos[0].state, 'wo_doble');
assert.equal(view.rounds[0].partidos[0].fueraDePlazo, true);
const withException = four.map(p => p.id === p1.a.id ? { ...p, liga2026: { ...p.liga2026, excepciones: { [L.pairKey(p1.a, p1.b)]: '2026-11-18' } } } : p);
view = L.buildSeasonView(withException, late, { season, gender: 'M', today: '2026-11-16' });
assert.equal(view.rounds[0].partidos[0].state, 'jugado');

// Empate en puntos entre dos: manda el enfrentamiento directo.
const three = eight.slice(0, 3);
const v3 = L.buildSeasonView(three, [], { season, gender: 'M', today: '2026-11-01' });
const pairs3 = v3.rounds.map(r => r.partidos[0]);
// a1 gana a b1; b2 gana a a2; a3 gana a b3 → todos 4 pts (3+1), ciclo perfecto.
const cyc = pairs3.map((p, i) => ({ ...mk(p, { id: `c${i}`, status: 'completado', fecha: p.window.start, ganadorId: p.a.id, marcador: '6-4, 6-4' }) }));
view = L.buildSeasonView(three, cyc, { season, gender: 'M', today: '2026-12-01' });
assert.equal(view.standings.every(r => r.pts === 4), true);
const two = [eight[0], eight[1]];
const vTwo = L.buildSeasonView([...two, enrolled('m9', 'Jugador 9')], [], { season, gender: 'M', today: '2026-11-01' });
const direct = vTwo.rounds.flatMap(r => r.partidos).find(p => [p.a.key, p.b.key].sort().join() === ['m1', 'm2'].join());
const h2h = [mk(direct, { id: 'h', status: 'completado', fecha: direct.window.start, ganadorId: direct.b.id, marcador: '7-6, 7-6' })];
view = L.buildSeasonView([...two, enrolled('m9', 'Jugador 9')], h2h, { season, gender: 'M', today: '2027-02-01' });
assert.equal(view.standings[0].key, direct.b.key);

// Retiro con la liga en curso: el rival gana por W.O. los cruces pendientes.
const withdrawn = four.map(p => p.id === 'm1' ? { ...p, liga2026: { ...p.liga2026, retirado: true, retiradoEn: '2026-11-11' } } : p);
view = L.buildSeasonView(withdrawn, [], { season, gender: 'M', today: '2026-11-12' });
const m1Rows = view.rounds.flatMap(r => r.partidos).filter(p => p.a.key === 'm1' || p.b.key === 'm1');
assert.equal(m1Rows[0].state, 'wo_doble'); // fecha 1 ya vencida sin jugar
assert.equal(m1Rows.slice(1).every(p => p.state === 'wo' && p.loser.key === 'm1'), true);

// Clasificados al Torneo de Maestros.
assert.equal(L.mastersSize(5), 4);
assert.equal(L.mastersSize(8), 6);
assert.equal(L.mastersSize(13), 8);
assert.equal(L.mastersSize(3), 3);

// Fase de la temporada.
assert.equal(L.buildSeasonView(eight, [], { season, gender: 'M', today: '2026-10-22' }).phase, 'inscripcion');
assert.equal(L.buildSeasonView(eight, [], { season, gender: 'M', today: '2026-11-22' }).phase, 'en_juego');

console.log('liga.test.js (temporada 2026): OK');

// La categoría elegida al inscribirse manda sobre la ficha (fichas sin género).
const noGender = { id: 'x1', nombre: 'Sin Género', email: 'x1@uct.cl', genero: '', liga2026: { inscrito: true, rama: 'F' } };
assert.equal(L.getEntrants([noGender], season, 'F').length, 1);
assert.equal(L.getEntrants([noGender], season, 'M').length, 0);
console.log('liga.test.js (categoría): OK');
