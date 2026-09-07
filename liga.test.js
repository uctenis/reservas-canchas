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
console.log('liga.test.js: OK');