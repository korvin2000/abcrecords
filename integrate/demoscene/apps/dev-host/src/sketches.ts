/**
 * Dev-only plate viewer: bakes the five pencil studies and lays them out for
 * eyeballing. It reaches straight into `packages/demoscene/src/render/`,
 * which is private implementation the public `exports` map does not expose.
 *
 * That deep import is the one deliberate exception in this repository, and it
 * is allowed only because this file is a local debugging tool that ships
 * nowhere. `apps/encyclopedia` must never do this (architecture guide 34.3).
 */
import { bakeSketches, SKETCH_SIZE } from '../../../packages/demoscene/src/render/sketches';

const out = document.getElementById('out')!;
const names = ['guitar', 'lute', 'portrait', 'bracing', 'fretboard'];

function section(title: string): HTMLDivElement {
  const h = document.createElement('h2');
  h.textContent = title;
  out.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  out.appendChild(row);
  return row;
}

const t0 = performance.now();
const list = bakeSketches();
const bakeMs = performance.now() - t0;

function render(): void {
  out.innerHTML = '';

  const crisp = section(`plates at 1:1 — bake ${bakeMs.toFixed(1)} ms`);
  list.forEach((s, i) => {
    const f = document.createElement('figure');
    const Z = Number(new URLSearchParams(location.search).get('z') ?? 2);
    const c = document.createElement('canvas');
    c.width = SKETCH_SIZE * Z;
    c.height = SKETCH_SIZE * Z;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(s, 0, 0, s.width, s.height, 0, 0, SKETCH_SIZE * Z, SKETCH_SIZE * Z);
    const cap = document.createElement('figcaption');
    cap.textContent = `${i}. ${names[i] ?? ''}`;
    f.append(c, cap);
    crisp.appendChild(f);
  });

  /* the same four-tap treatment the stage uses, at the alpha it uses */
  const soft = section('as the stage draws them (0.72 fade × 0.5)');
  list.forEach((s, i) => {
    const f = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 360;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e0cda0';
    g.fillRect(0, 0, 360, 360);
    const a = 0.72 * 0.5;
    const spread = 1.6;
    const offs = [[-spread, -spread * 0.6], [spread, -spread * 0.4], [-spread * 0.5, spread], [0, 0]];
    offs.forEach((o, k) => {
      g.globalAlpha = a * (k === 3 ? 0.5 : 0.24);
      g.drawImage(s, 0, 0, s.width, s.height, 10 + o[0], 10 + o[1], SKETCH_SIZE, SKETCH_SIZE);
    });
    g.globalAlpha = 1;
    const cap = document.createElement('figcaption');
    cap.textContent = `${i}. ${names[i] ?? ''}`;
    f.append(c, cap);
    soft.appendChild(f);
  });
}

render();
/* the portrait decodes async; redraw once it can be in */
setTimeout(render, 400);
