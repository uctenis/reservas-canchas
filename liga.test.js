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