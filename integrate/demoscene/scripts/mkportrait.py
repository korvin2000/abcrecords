"""
Bakes sketches/human01.png into the two things sketchPortrait() re-draws it
from: a tone map to hatch across, and the line work to lay over the hatching.

The source is an 8-colour pen study on tan paper. Four of those levels are ink
and four are paper grain, so the ink density recovers exactly.

  * The tone map is that density blurred down small, sharpened so the eyes and
    the mouth survive the reduction, and quantised to eight steps -- a grey PNG
    of a few kilobytes.
  * The line work is a difference of two Gaussians, which is positive exactly
    where the paper is darker than its own neighbourhood -- which is what a
    drawn line is. Traced at one level and simplified, the creases, lids, hair
    edges and folds come out as a few hundred short polylines, delta-coded to
    a byte a step.

No pixel of the original ships. At load the renderer hatches the tone and
strokes the lines with the same jittered pencil the other studies use, so the
portrait is drawn rather than pasted -- same ink, same hand -- and bakes into a
bitmap once, exactly like every other sketch.
"""
from PIL import Image, ImageFilter
import numpy as np, io, base64, math, textwrap, pathlib
from collections import defaultdict

SRC      = pathlib.Path('sketches/human01.png')
OUT      = pathlib.Path('src/render/portraitData.ts')
PAPER    = 145.0    # everything lighter than this is paper, not ink
DEEP     = 47.0     # the darkest ink level in the source
FLOOR    = 0.14     # noise floor: below this the "ink" is paper dither
GAMMA    = 0.55     # lifts the mid tones so hatching has something to bite on
BLUR     = 0.45
SHARPEN  = 160      # keeps the eyes from dissolving at this size
WIDTH    = 190
LEVELS   = 8

LW       = 420                # resolution the creases are traced at
DOG      = (0.9, 4.0, 0.94)   # the two blurs and the mix that isolate a line
LEVEL    = 0.055              # how dark a line has to be to be traced
SIMPLIFY = 0.75               # Douglas-Peucker tolerance, in pixels
MINLEN   = 16                 # shorter than this is grain, not a crease
GRID     = 1024               # coordinates quantised to this across the plate

g = np.asarray(Image.open(SRC).convert('L')).astype(np.float32)
d = np.clip((PAPER - g) / (PAPER - DEEP), 0.0, 1.0)

# trim to the drawn area using the ink profile, not the paper
col, row = d.sum(0), d.sum(1)
xs = np.where(col > col.max() * 0.02)[0]
ys = np.where(row > row.max() * 0.02)[0]
d = d[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
ch, cw = d.shape

# ---------------------------------------------------------------- tone map
height = int(round(WIDTH * ch / cw))
im = Image.fromarray((d * 255).astype(np.uint8)).resize((WIDTH, height), Image.LANCZOS)
im = im.filter(ImageFilter.GaussianBlur(BLUR))
im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=SHARPEN, threshold=2))

v = np.asarray(im).astype(np.float32) / 255.0
v = np.clip((v - FLOOR) / (1.0 - FLOOR), 0.0, 1.0) ** GAMMA
q = np.round(v * (LEVELS - 1)).astype(np.uint8)

tone = Image.fromarray(q, 'P')
tone.putpalette([c for i in range(256) for c in (min(255, i * 255 // (LEVELS - 1)),) * 3])
buf = io.BytesIO()
tone.save(buf, 'PNG', optimize=True, bits=4)
tone64 = base64.b64encode(buf.getvalue()).decode('ascii')

# --------------------------------------------------------------- line work
lh = int(round(LW * ch / cw))
li = Image.fromarray((d * 255).astype(np.uint8)).resize((LW, lh), Image.LANCZOS)
b1 = np.asarray(li.filter(ImageFilter.GaussianBlur(DOG[0]))).astype(np.float32) / 255
b2 = np.asarray(li.filter(ImageFilter.GaussianBlur(DOG[1]))).astype(np.float32) / 255
dog = b1 - b2 * DOG[2]

CASES = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 5: [(3, 0), (1, 2)],
         6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)], 9: [(2, 0)], 10: [(2, 1), (0, 3)],
         11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}


def march(f, level):
    """Marching squares: the level set of `f`, as unordered segments."""
    hh, ww = f.shape
    segs = []

    def ip(a, b, pa, pb):
        t = (level - pa) / (pb - pa) if pb != pa else 0.5
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    for y in range(hh - 1):
        for x in range(ww - 1):
            v0, v1, v2, v3 = f[y, x], f[y, x + 1], f[y + 1, x + 1], f[y + 1, x]
            idx = (int(v0 > level) | (int(v1 > level) << 1)
                   | (int(v2 > level) << 2) | (int(v3 > level) << 3))
            if idx in (0, 15):
                continue
            pq, qq, rr, ss = (x, y), (x + 1, y), (x + 1, y + 1), (x, y + 1)
            e = [ip(pq, qq, v0, v1), ip(qq, rr, v1, v2),
                 ip(ss, rr, v3, v2), ip(pq, ss, v0, v3)]
            for a, b in CASES[idx]:
                segs.append((e[a], e[b]))
    return segs


def stitch(segs):
    """Segments back into polylines, head to tail."""
    key = lambda pt: (round(pt[0], 4), round(pt[1], 4))
    heads = defaultdict(list)
    for i, (a, _) in enumerate(segs):
        heads[key(a)].append(i)
    used = [False] * len(segs)
    lines = []
    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        line = [segs[i][0], segs[i][1]]
        while True:
            nxt = None
            for j in heads.get(key(line[-1]), []):
                if not used[j]:
                    nxt = j
                    break
            if nxt is None:
                break
            used[nxt] = True
            line.append(segs[nxt][1])
            if key(line[-1]) == key(line[0]):
                break
        lines.append(line)
    return lines


def rdp(pts, eps):
    """Douglas-Peucker, so a traced contour costs points where it turns."""
    if len(pts) < 3:
        return pts

    def dist(pt, a, b):
        ax, ay = a
        bx, by = b
        px, py = pt
        dx, dy = bx - ax, by - ay
        ll = dx * dx + dy * dy
        if ll == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ll))
        return math.hypot(px - ax - dx * t, py - ay - dy * t)

    a, b = pts[0], pts[-1]
    dm, im_ = 0.0, 0
    for i in range(1, len(pts) - 1):
        dd = dist(pts[i], a, b)
        if dd > dm:
            dm, im_ = dd, i
    if dm > eps:
        return rdp(pts[:im_ + 1], eps)[:-1] + rdp(pts[im_:], eps)
    return [a, b]


polys = []
for line in stitch(march(dog, LEVEL)):
    if len(line) < MINLEN:
        continue
    if sum(math.dist(line[i], line[i + 1]) for i in range(len(line) - 1)) < MINLEN:
        continue
    polys.append(rdp(line, SIMPLIFY))

# quantise, delta-code, and split any step a signed byte cannot reach
k = GRID / LW
blob = bytearray()
npts = 0
for poly in polys:
    pt = [(round(x * k), round(y * k)) for x, y in poly]
    steps = []
    for i in range(len(pt) - 1):
        dx = pt[i + 1][0] - pt[i][0]
        dy = pt[i + 1][1] - pt[i][1]
        n = max(1, math.ceil(max(abs(dx), abs(dy)) / 120))
        for j in range(n):
            ax = pt[i][0] + round(dx * j / n)
            ay = pt[i][1] + round(dy * j / n)
            bx = pt[i][0] + round(dx * (j + 1) / n)
            by = pt[i][1] + round(dy * (j + 1) / n)
            steps.append((bx - ax, by - ay))
    x0, y0 = pt[0]
    for c in range(0, len(steps), 255):
        chunk = steps[c:c + 255]
        blob += bytes([x0 >> 8, x0 & 255, y0 >> 8, y0 & 255, len(chunk)])
        for dx, dy in chunk:
            blob += bytes([dx & 255, dy & 255])
            x0 += dx
            y0 += dy
        npts += len(chunk) + 1

line64 = base64.b64encode(bytes(blob)).decode('ascii')


def literal(b64, indent='  '):
    parts = textwrap.wrap(b64, 96)
    return '\n'.join("%s'%s' +" % (indent, t) for t in parts).rstrip(' +') + ';'


header = (
    "/**\n"
    " * What `sketchPortrait` draws a pen study from -- not the study itself.\n"
    " *\n"
    " * `PORTRAIT_TONE` is its shading, %d x %d at eight levels of grey (%.1f kB),\n"
    " * hatched across at load. `PORTRAIT_LINES` is its line work: %d creases,\n"
    " * lids, hair edges and folds (%d points, %.1f kB), delta-coded to a byte a\n"
    " * step and stroked over the hatching. Coordinates sit in a %d-wide grid\n"
    " * across the plate, `y` on the same scale, so the aspect comes out of the\n"
    " * data rather than being assumed.\n"
    " *\n"
    " * Generated by scripts/mkportrait.py. Inline, so still no network request.\n"
    " */\n"
    % (WIDTH, height, len(tone64) / 1024, len(polys), npts, len(line64) / 1024, GRID)
)

OUT.write_text(
    header
    + "export const PORTRAIT_TW = %d;\n" % WIDTH
    + "export const PORTRAIT_TH = %d;\n" % height
    + "export const PORTRAIT_GRID = %d;\n\n" % GRID
    + "export const PORTRAIT_TONE =\n  'data:image/png;base64,' +\n"
    + literal(tone64)
    + "\n\nexport const PORTRAIT_LINES =\n"
    + literal(line64)
    + "\n",
    encoding='utf-8',
)

print('tone %dx%d: png %d B / b64 %d B' % (WIDTH, height, len(buf.getvalue()), len(tone64)))
print('lines: %d polylines, %d points, %d B / b64 %d B' % (len(polys), npts, len(blob), len(line64)))
print('-> %s' % OUT)
