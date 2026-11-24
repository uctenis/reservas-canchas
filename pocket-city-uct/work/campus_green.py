"""Add the campus lawns and trees that OpenStreetMap leaves blank (illustrative).

Shapes traced roughly from the DGDC campus illustration (uctenis/dgdc, src/assets/campus/csf.webp): green front strip
along Avenida Alemania, the central lawn west of the promenade, the planted strip east of it and the strip along
Pasaje El Bosque. Run after prep.py:  python3 work/campus_green.py work/scene.json
"""
import json, random, sys
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union

p = sys.argv[1]
s = json.load(open(p))

def poly(r):
    try: return Polygon(r[0], r[1:]).buffer(0)
    except Exception: return Polygon()

blds = unary_union([Polygon(b['ring']).buffer(0) for b in s['buildings'] if len(b.get('ring', [])) >= 3])
hard = unary_union([poly(x) for k in ('roads', 'paths', 'walk') for x in s.get(k, []) if x])
blocked = unary_union([blds.buffer(1.2), hard.buffer(.4)])

AREAS = [box(-75, 66, -3, 112), box(-24, -50, -2, 30), box(14, -60, 30, 62), box(-75, -82, -42, 30), box(14, 70, 32, 108)]
green = unary_union(AREAS).difference(blocked)
geoms = [g for g in getattr(green, 'geoms', [green]) if g.geom_type == 'Polygon' and g.area > 25]
for g in geoms:
    g = g.simplify(.2)
    s['lawns'].append({'kind': 'garden', 'r': [[[round(x, 2), round(y, 2)] for x, y in list(g.exterior.coords)[:-1]]]})

name = 'Campus tree'
if name not in s['species']: s['species'].append(name)
sp = s['species'].index(name)
rng = random.Random(11)
have = [Point(t[0], t[1]) for t in s['trees']]
treeable = green.buffer(-1.5).difference(blds.buffer(2.5))
def add(x, y):
    q = Point(x, y)
    if treeable.contains(q) and all(q.distance(h) > 6 for h in have):
        s['trees'].append([round(x, 2), round(y, 2), sp, '']); have.append(q)
for x in range(-74, -3, 8): add(x + rng.uniform(-1, 1), 108 + rng.uniform(-1, 1))      # row along Avenida Alemania
for _ in range(900):
    b = rng.choice(AREAS); x0, y0, x1, y1 = b.bounds
    add(rng.uniform(x0, x1), rng.uniform(y0, y1))
json.dump(s, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(geoms)} lawns, trees now {len(s["trees"])}')
