/**
 * Dev-only portrait-variant viewer. Same deep-import caveat as `sketches.ts`:
 * a local debugging tool, not a pattern to copy into a host.
 */
import { sketchPortrait, type PortraitStyle } from '../../../packages/demoscene/src/render/sketches';

type Variant = { name: string; note: string; style: PortraitStyle };

const steps = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.74, 0.83, 0.91];
const angles = [-62, -62, -62, 22, -62, 22, -62, 78, -62, 22];

function passes(sp0: number, sp1: number, a0: number, a1: number) {
  return steps.map((lv, i) => {
    const t = i / (steps.length - 1);
    return [angles[i], sp0 + (sp1 - sp0) * t, lv, a0 + (a1 - a0) * t] as const;
  });
}

const B = { size: 544, fill: 0.632, pen: 0.7, step: 1.2, jitter: 0.7 };
const C = { size: 680, fill: 0.632, pen: 0.7, step: 1.2, jitter: 0.7 };
const pB = passes(2.3, 1.6, 0.1, 0.28);
const pC = passes(2.6, 1.8, 0.1, 0.28);

const V: Variant[] = [
  { name: 'B0', note: 'B, hatching only', style: { ...B, linePen: 0.8, lineAlpha: 0, passes: pB } },
  { name: 'B1', note: 'B + creases 0.13', style: { ...B, linePen: 0.7, lineAlpha: 0.13, passes: pB } },
  { name: 'B2', note: 'B + creases 0.19', style: { ...B, linePen: 0.8, lineAlpha: 0.19, passes: pB } },
  { name: 'C0', note: 'C, hatching only', style: { ...C, linePen: 0.8, lineAlpha: 0, passes: pC } },
  { name: 'C1', note: 'C + creases 0.13', style: { ...C, linePen: 0.7, lineAlpha: 0.13, passes: pC } },
  { name: 'C2', note: 'C + creases 0.19', style: { ...C, linePen: 0.8, lineAlpha: 0.19, passes: pC } },
  { name: 'C3', note: 'C + creases 0.26, heavier pen', style: { ...C, linePen: 1, lineAlpha: 0.26, passes: pC } },
  {
    name: 'C4',
    note: 'C, lighter hatching + creases 0.24',
    style: { ...C, linePen: 0.9, lineAlpha: 0.24, passes: passes(3.0, 2.1, 0.08, 0.22) },
  },
];

const out = document.getElementById('out')!;

function draw(dest: number, soft: boolean): void {
  const h = document.createElement('h2');
  h.textContent = soft
    ? 'as the stage draws them — faded and four-tap blurred'
    : `plates at ${dest}px`;
  out.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  out.appendChild(row);

  for (const v of V) {
    const s = sketchPortrait(v.style);
    const f = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = dest;
    c.height = dest;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if (soft) {
      g.fillStyle = '#e0cda0';
      g.fillRect(0, 0, dest, dest);
    }
    const cap = document.createElement('figcaption');
    cap.textContent = `${v.name} · ${v.note}`;
    f.append(c, cap);
    row.appendChild(f);

    /* the plate fills in once the tone map decodes */
    setTimeout(() => {
      if (soft) {
        const a = 0.72 * 0.5;
        const sp = 1.6;
        const offs = [[-sp, -sp * 0.6], [sp, -sp * 0.4], [-sp * 0.5, sp], [0, 0]];
        offs.forEach((o, k) => {
          g.globalAlpha = a * (k === 3 ? 0.5 : 0.24);
          g.drawImage(s, 0, 0, s.width, s.height, o[0], o[1], dest, dest);
        });
        g.globalAlpha = 1;
      } else {
        g.drawImage(s, 0, 0, s.width, s.height, 0, 0, dest, dest);
      }
    }, 600);
  }
}

draw(380, false);
draw(380, true);
