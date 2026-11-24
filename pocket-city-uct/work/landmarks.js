/* Campus San Francisco (UCT, Temuco) landmarks.
   Museo Regional de la Araucanía (Casa Thiers, OSM w51653575): 1924 casa quinta by Carlos Caballero, two storeys with
   large windows; clay tiles replaced by metal sheets in the 1970s; a terrace with four columns and a wide stair faced in
   slate (heritage decree, Diario Oficial 2024; patrimonio.bienes.cl). No plan was readable: the volume follows the OSM
   footprint, the side of the terrace, the wall colour and the roof pitch are interpreted (illustrative).
   Rewe (OSM artwork node "Rewe"): a carved stepped post; its size and the foye branches are illustrative.
   Campus parts after the DGDC campus illustration (uctenis/dgdc src/assets/campus/csf.webp): see each function. */
const MUSEO = 'w51653575';
const M_WALL = '#efe6d3', M_TRIM = '#fbf7ee', M_ROOF = '#6d7378', SLATE = '#5f6468';

function face4(q, col, ink = .45) { const n = vNewell(q); return vis(n) ? shape(q, tone(n, soft(col)), ink) : ''; }
function box(x0, y0, x1, y1, z0, z1, col, along, across, o) {   // an oriented box in the museum's frame
  const P = (u, v, z) => [o[0] + along[0] * u + across[0] * v, o[1] + along[1] * u + across[1] * v, z];
  const r = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  let s = '';
  for (let i = 0; i < 4; i++) { const a = r[i], b = r[(i + 1) % 4]; s += face4([P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)], col); }
  return s + shape(r.map(p => P(p[0], p[1], z1)), tone([0, 0, 1], soft(col)), .4);
}

function museo() {
  const b = findBuilding(MUSEO); if (!b) return null;
  const ring = ccw(b.ring), { c, ax, L, W } = b.obb, WALL = 7.6;
  const nx = [-ax[1], ax[0]];
  const side = (nx[1] > 0) ? 1 : -1;                     // the terrace faces the park, north of the house
  const across = [nx[0] * side, nx[1] * side];
  const body = block(ring, 0, WALL, { facade: 'stucco', wall: M_WALL, trim: M_TRIM, floor: 3.8, bay: 3.1, glass: ['#5d6d78'], shop: 'none' });
  const roof = roofOver({ c, ax, L: L - .2, W: W - .2 }, WALL, { roof: 'hipped', pitch: 26, roofColour: M_ROOF, eaves: .55, wall: M_WALL });
  // terrace: a raised deck with four columns and a flat roof, then a wide slate stair down to the garden
  const o = [c[0] + across[0] * (W / 2), c[1] + across[1] * (W / 2)];
  const D = 3.4, HL = 5.2, DECK = .9, TOP = 4.1;
  const P = (u, v, z) => [o[0] + ax[0] * u + across[0] * v, o[1] + ax[1] * u + across[1] * v, z];
  const tRing = [P(-HL, 0, 0), P(HL, 0, 0), P(HL, D, 0), P(-HL, D, 0)].map(p => p.slice(0, 2));
  const sRing = [P(-2.6, D, 0), P(2.6, D, 0), P(2.6, D + 2.2, 0), P(-2.6, D + 2.2, 0)].map(p => p.slice(0, 2));
  const terrace = () => {
    let s = box(-HL, 0, HL, D, 0, DECK, '#d9d2c3', ax, across, o);
    for (const u of [-HL + .35, -HL / 3, HL / 3, HL - .35]) {
      s += stick(P(u, D - .35, DECK), P(u, D - .35, TOP - .25), .2, M_TRIM);
      s += box(u - .28, D - .63, u + .28, D - .07, TOP - .3, TOP - .2, M_TRIM, ax, across, o);   // capital
    }
    s += box(-HL, 0, HL, D, TOP - .2, TOP + .15, M_TRIM, ax, across, o);                          // entablature, terrace above
    for (let u = -HL; u <= HL + .01; u += .45) s += edge(P(u, D - .05, TOP + .15), P(u, D - .05, TOP + .9), M_TRIM, .05);
    s += edge(P(-HL, D - .05, TOP + .9), P(HL, D - .05, TOP + .9), M_TRIM, .09);
    return s;
  };
  const stair = () => {
    let s = '';
    for (let k = 0; k < 5; k++) { const z = DECK * (1 - k / 5); s += box(-2.6, D + k * .44, 2.6, D + (k + 1) * .44, 0, z, SLATE, ax, across, o); }
    return s;
  };
  return obj(ring.concat(tRing, sRing), WALL + 6, () => planOrder([
    { fp: ring, z1: WALL + 6, svg: body.draw() + roof() },
    { fp: tRing, z1: TOP + .9, svg: terrace() },
    { fp: sRing, z1: DECK, svg: stair() }]));
}

function rewe() {
  const p = SCENE.pois.find(q => q.name === 'Rewe'); if (!p) return null;
  const x = p.x, y = p.y, H = 3.2, WOOD = '#8a6545';
  return obj(rect(x, y, 1.2, 1.2), H + .8, () => {
    let s = stick([x, y, 0], [x, y, H], .3, WOOD);
    for (let z = .35; z < H - .2; z += .48) s += edge([x - .2, y - .2, z], [x + .2, y - .2, z], '#4f3a29', .05);   // carved steps
    s += ball([x, y, H + .05], .2, soft('#7a5a3e'));
    for (const [dx, dy] of [[.5, .2], [-.4, .35], [.1, -.5]]) {                                              // foye (canelo) branches
      s += stick([x, y, H - .3], [x + dx, y + dy, H + .55], .03, '#5f4630') + ball([x + dx, y + dy, H + .6], .26, soft('#5f9a4e'));
    }
    return s;
  });
}


const AULA = 'w90759316', CUBO = 'w1288078275';

// Aula Magna y Biblioteca (CSF02): dark volume with a sawtooth roof, as in the DGDC campus illustration (illustrative)
function aulaMagna() {
  const b = findBuilding(AULA); if (!b) return null;
  const ring = ccw(b.ring), { c, ax, L, W } = b.obb, H = 13, DARK = '#5a5e66';
  const body = block(ring, 0, H, { facade: 'glass', wall: DARK, glass: ['#3f4a55', '#47525d'], frame: '#2f3338', floor: 4.3, bay: 2.4, top: '#6b6f76' });
  const nx = [-ax[1], ax[0]], n = 4, len = L * .72, wid = W * .7, step = len / n, rise = 3.2;
  const P = (u, v, z) => [c[0] + ax[0] * u + nx[0] * v, c[1] + ax[1] * u + nx[1] * v, z];
  const teeth = () => {
    let s = '';
    for (let k = 0; k < n; k++) {
      const u0 = -len / 2 + k * step, u1 = u0 + step, v0 = -wid / 2, v1 = wid / 2;
      const glass = [P(u1, v0, H), P(u1, v1, H), P(u1, v1, H + rise), P(u1, v0, H + rise)];   // vertical glazed face
      const slope = [P(u0, v0, H), P(u1, v0, H + rise), P(u1, v1, H + rise), P(u0, v1, H)];
      const sideA = [P(u0, v0, H), P(u1, v0, H), P(u1, v0, H + rise)], sideB = [P(u0, v1, H), P(u1, v1, H + rise), P(u1, v1, H)];
      const parts = [[slope, '#7a7e85'], [glass, '#46515c'], [sideA, '#666a71'], [sideB, '#666a71']]
        .map(([q, col]) => ({ q, col, d: depthOf(avg(q)) })).sort((a, b) => a.d - b.d);
      for (const f of parts) s += face4(f.q, f.col, .45);
    }
    return s;
  };
  return obj(ring, H + rise + .5, () => body.draw() + teeth());
}

// Glulam timber pavilion beside Pasaje El Bosque: open ground floor on posts, slatted timber upper floors, as in the
// DGDC illustration; the glulam structure of CSF14 to CSF16 is in the DGDC 2026 budget (illustrative here)
function cuboMadera() {
  const b = findBuilding(CUBO); if (!b) return null;
  const ring = ccw(b.ring), { c, ax, L, W } = b.obb, Z0 = 3.2, H = 12.2, WOOD = '#c9955a';
  const nx = [-ax[1], ax[0]], P = (u, v, z) => [c[0] + ax[0] * u + nx[0] * v, c[1] + ax[1] * u + nx[1] * v, z];
  const inner = [P(-L / 2 + 1.6, -W / 2 + 1.6, 0), P(L / 2 - 1.6, -W / 2 + 1.6, 0), P(L / 2 - 1.6, W / 2 - 1.6, 0), P(-L / 2 + 1.6, W / 2 - 1.6, 0)].map(p => p.slice(0, 2));
  const core = block(ccw(inner), 0, Z0, { facade: 'glass', wall: '#d9d4c8', glass: ['#5b6b75'], floor: Z0, bay: 2.2 });
  const upper = block(ring, Z0, H, { facade: 'office', wall: '#e9dcc4', glass: ['#5b6b75'], frame: '#8a6a45', floor: 3, bay: 1.6, top: '#cfc6b6' });
  const slats = () => {
    let s = '';
    const sides = [[[-L / 2, -W / 2], [L / 2, -W / 2]], [[L / 2, -W / 2], [L / 2, W / 2]], [[L / 2, W / 2], [-L / 2, W / 2]], [[-L / 2, W / 2], [-L / 2, -W / 2]]];
    for (const [a, e] of sides) {
      const o = .25, A = P(a[0] * (1 + o / L), a[1] * (1 + o / W), 0), E = P(e[0] * (1 + o / L), e[1] * (1 + o / W), 0);
      const nrm = vNewell([[A[0], A[1], Z0], [E[0], E[1], Z0], [E[0], E[1], H], [A[0], A[1], H]]);
      if (!vis(nrm)) continue;
      const len = Math.hypot(E[0] - A[0], E[1] - A[1]), k = Math.round(len / .7);
      for (let i = 0; i <= k; i++) { const t = i / k, x = A[0] + (E[0] - A[0]) * t, y = A[1] + (E[1] - A[1]) * t; s += edge([x, y, Z0], [x, y, H], tone(nrm, soft(WOOD)), .16); }
      s += edge([A[0], A[1], H], [E[0], E[1], H], tone(nrm, soft(WOOD)), .3) + edge([A[0], A[1], Z0], [E[0], E[1], Z0], tone(nrm, soft(WOOD)), .3);
    }
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {   // glulam posts
      const q = P(u * (L / 2 - .2), v * (W / 2 - .2), 0); s += stick(q, [q[0], q[1], Z0], .22, WOOD);
    }
    const tr = [P(-3, -3, 0), P(3, -3, 0), P(3, 3, 0), P(-3, 3, 0)].map(p => p.slice(0, 2));
    return s + block(ccw(tr), H, H + 1.2, { facade: 'plain', wall: '#e9dcc4', top: '#d8cfbf' }).draw();
  };
  return obj(ring, H + 1.5, () => core.draw() + upper.draw() + slats());
}

// Central lawn: white cross and small stepped amphitheatre; flagpoles at the entrance (DGDC illustration; positions illustrative)
function patio() {
  const out = [];
  const X = -12, Y = 5;
  out.push(obj(rect(X, Y, 1, 1), 5.2, () => box(-.2, -.2, .2, .2, 0, 5, '#f6f4ee', [1, 0], [0, 1], [X, Y]) + box(-1.2, -.2, 1.2, .2, 3.3, 3.7, '#f6f4ee', [1, 0], [0, 1], [X, Y])));
  const AX = -12, AY = -30;
  out.push(obj(rect(AX, AY, 13, 13), 1.6, () => {
    let s = '';
    for (let k = 0; k < 4; k++) {
      const r1 = 6 - k * 1.2, r0 = r1 - 1.2, z = .4 * (k + 1), arc = (r, zz) => Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1 + i / 12); return [AX + Math.cos(a) * r, AY + Math.sin(a) * r, zz]; });
      s += shape([...arc(r1, z), ...arc(Math.max(r0, .3), z).reverse()], tone([0, 0, 1], soft('#dcd8cf')), .35);
      for (let i = 0; i < 12; i++) { const A = arc(r1, 0)[i], B = arc(r1, 0)[i + 1]; s += face4([A, B, [B[0], B[1], z], [A[0], A[1], z]], '#cfcac0', .3); }
    }
    return s;
  }));
  const flags = [['#d52b1e', '#ffffff', '#0039a6'], ['#ffffff', '#ffffff', '#3d7a4a'], ['#ffffff', '#ffffff', '#2e5b8a']];
  flags.forEach((f, i) => {
    const x = 20 + i * 3, y = 98;
    out.push(obj(rect(x, y, 2, 1), 9, () => {
      let s = stick([x, y, 0], [x, y, 8.5], .06, '#d9dcdf');
      const q = (z0, z1, col) => shape([[x, y, z0], [x + 1.8, y, z0], [x + 1.8, y, z1], [x, y, z1]], col, .25);
      s += q(7.7, 8.4, f[1]) + q(7, 7.7, f[0]) + shape([[x, y, 7.7], [x + .6, y, 7.7], [x + .6, y, 8.4], [x, y, 8.4]], f[2], .2);
      return s;
    }));
  });
  return out;
}

const LANDMARKS = [
  { name: 'Museo Regional de la Araucanía', ids: [MUSEO], build: museo },
  { name: 'Rewe', ids: [], build: rewe },
  { name: 'Aula Magna', ids: [AULA], build: aulaMagna },
  { name: 'Pabellón de madera', ids: [CUBO], build: cuboMadera },
  { name: 'Patio central', ids: [], build: patio },
];
