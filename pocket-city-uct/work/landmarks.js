/* Campus San Francisco (UCT, Temuco) landmarks.
   Museo Regional de la Araucanía (Casa Thiers, OSM w51653575): 1924 casa quinta by Carlos Caballero, two storeys with
   large windows; clay tiles replaced by metal sheets in the 1970s; a terrace with four columns and a wide stair faced in
   slate (heritage decree, Diario Oficial 2024; patrimonio.bienes.cl). No plan was readable: the volume follows the OSM
   footprint, the side of the terrace, the wall colour and the roof pitch are interpreted (illustrative).
   Rewe (OSM artwork node "Rewe"): a carved stepped post; its size and the foye branches are illustrative.
   Tennis courts (OSM leisure=pitch sport=tennis): lines at ITF dimensions; the surface colour is illustrative. */
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

function courts() {
  const out = [];
  for (const l of SCENE.lawns.filter(l => l.kind === 'pitch')) {
    const r = l.r[0]; if (r.length !== 4) continue;
    const e = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.abs(Math.max(e(r[0], r[1]), e(r[1], r[2])) - 24.5) > 3) continue;         // tennis-sized only
    const cx = avg(r.map(p => [...p, 0])), long = e(r[0], r[1]) > e(r[1], r[2]) ? [r[0], r[1]] : [r[1], r[2]];
    const L0 = e(...long), ux = [(long[1][0] - long[0][0]) / L0, (long[1][1] - long[0][1]) / L0], vx = [-ux[1], ux[0]];
    const P = (u, v, z = .04) => [cx[0] + ux[0] * u + vx[0] * v, cx[1] + ux[1] * u + vx[1] * v, z];
    const hl = 23.77 / 2, hw = 10.97 / 2, sw = 8.23 / 2, sv = 6.40;
    out.push(obj(r, 1.2, () => {
      let s = shape(r.map(p => [p[0], p[1], .02]), '#7a9f84', .3);
      s += shape([P(-hl, -hw, .03), P(hl, -hw, .03), P(hl, hw, .03), P(-hl, hw, .03)], '#5d8a73', 0);
      const ln = (a, b) => edge(a, b, '#f7f3ea', .07);
      s += ln(P(-hl, -hw), P(hl, -hw)) + ln(P(-hl, hw), P(hl, hw)) + ln(P(-hl, -hw), P(-hl, hw)) + ln(P(hl, -hw), P(hl, hw));
      s += ln(P(-hl, -sw), P(hl, -sw)) + ln(P(-hl, sw), P(hl, sw));
      s += ln(P(-sv, -sw), P(-sv, sw)) + ln(P(sv, -sw), P(sv, sw)) + ln(P(-sv, 0), P(sv, 0));
      s += stick(P(0, -hw - .9, 0), P(0, -hw - .9, 1.07), .04, '#3c4246') + stick(P(0, hw + .9, 0), P(0, hw + .9, 1.07), .04, '#3c4246');
      s += '<g opacity="0.35">' + shape([P(0, -hw - .9, .1), P(0, hw + .9, .1), P(0, hw + .9, 1.07), P(0, -hw - .9, .914)], '#282c30', .15) + '</g>';
      s += edge(P(0, -hw - .9, .914), P(0, hw + .9, 1.07), '#f7f3ea', .05);
      return s;
    }));
  }
  return out;
}

const LANDMARKS = [
  { name: 'Museo Regional de la Araucanía', ids: [MUSEO], build: museo },
  { name: 'Rewe', ids: [], build: rewe },
  { name: 'Canchas de tenis', ids: [], build: courts },
];
