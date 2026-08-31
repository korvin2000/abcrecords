import { SERIF } from '../core/palette';

/**
 * A manuscript corner: an L of double rules, an Ionic volute curling off each
 * arm, a lozenge at the elbow and two acanthus leaves. Drawn once for the
 * top-left and mirrored into the other three, so the four read as one border.
 */
export const CORNER_SVG = `
<svg class="corner {P}" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.15"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 21 V6.5 A3 3 0 0 1 6.5 3.5 H21"/>
    <path d="M9 20 V11.2 A2.2 2.2 0 0 1 11.2 9 H20"/>
    <path d="M21 3.5 C27.5 3.5 32 6.6 32 11 C32 14.6 29 16.8 26.3 16
             C24 15.3 23.2 12.6 25 11.2 C26.2 10.3 27.9 10.9 28.1 12.3"/>
    <path d="M3.5 21 C3.5 27.5 6.6 32 11 32 C14.6 32 16.8 29 16 26.3
             C15.3 24 12.6 23.2 11.2 25 C10.3 26.2 10.9 27.9 12.3 28.1"/>
    <path d="M24.4 4.4 C24.8 8 22.8 11 19.6 12.3" stroke-width="0.85"/>
    <path d="M4.4 24.4 C8 24.8 11 22.8 12.3 19.6" stroke-width="0.85"/>
  </g>
  <path d="M9 6.6 L11.4 9 L9 11.4 L6.6 9 Z" fill="currentColor"/>
  <circle cx="27.4" cy="12.6" r="1.05" fill="currentColor"/>
  <circle cx="12.6" cy="27.4" r="1.05" fill="currentColor"/>
</svg>`;

export function cornersHtml(): string {
  return ['tl', 'tr', 'bl', 'br'].map((p) => CORNER_SVG.replace('{P}', p)).join('');
}

export const CSS = `
*,*::before,*::after{box-sizing:border-box}
:host{all:initial}

.host{position:fixed;inset:0;z-index:2147483000;display:flex;
  align-items:center;justify-content:center;padding:24px 18px;
  font-family:${SERIF};-webkit-font-smoothing:antialiased;
  opacity:0;transition:opacity .38s ease}
.host.in{opacity:1}
.scrim{position:absolute;inset:0;background:rgba(40,28,15,.72)}

.frame{position:relative;width:100%;
  max-width:min(1000px, calc((100vh - 214px) * 2.2326));
  background:linear-gradient(178deg,#f8f0dc 0%,#f2e7cb 58%,#ecdfbe 100%);
  border:1px solid #c9a969;border-radius:16px;
  box-shadow:0 1px 1px rgba(70,50,24,.14),0 12px 38px rgba(38,26,12,.30);
  padding:16px 20px 13px;color:#2b1e10;
  transform:translateY(8px) scale(.988);
  transition:transform .38s cubic-bezier(.2,.7,.3,1)}
.host.in .frame{transform:none}
.frame::after{content:"";position:absolute;inset:5px;border-radius:12px;
  border:1px solid rgba(181,139,52,.34);pointer-events:none}

.corner{position:absolute;width:42px;height:42px;color:rgba(154,118,42,.8);
  pointer-events:none}
.corner.tl{top:6px;left:6px}
.corner.tr{top:6px;right:6px;transform:scaleX(-1)}
.corner.bl{bottom:6px;left:6px;transform:scaleY(-1)}
.corner.br{bottom:6px;right:6px;transform:scale(-1,-1)}

header{text-align:center;padding:2px 48px 10px}
h2{margin:0;font-size:14px;font-weight:600;letter-spacing:.34em;
  text-transform:uppercase;color:#6e1b23}
.tagline{margin:5px 0 0;font-size:12.5px;font-style:italic;color:#6b4c25}
.rule{display:flex;align-items:center;gap:9px;margin:9px auto 0;max-width:420px;
  color:rgba(181,139,52,.85)}
.rule i{flex:1;height:1px;background:currentColor;opacity:.85}
.rule b{font-size:10px;line-height:1;font-weight:400;color:#8c2b2b}

.stage{position:relative;width:100%;aspect-ratio:96/43;border-radius:10px;
  overflow:hidden;border:1px solid rgba(160,124,44,.48);background:#efe3c2;
  box-shadow:inset 0 0 0 1px rgba(255,250,236,.55)}
canvas{display:block;width:100%;height:100%}

.plain{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;
  padding:28px 34px 32px;background:#f3e8cd;display:none;
  text-align:center;font-size:15px;line-height:1.62;color:#3b2a17;
  scrollbar-width:thin;scrollbar-color:rgba(160,124,44,.55) transparent}
.plain.on{display:block}
.plain::-webkit-scrollbar{width:9px}
.plain::-webkit-scrollbar-track{background:rgba(181,139,52,.08)}
.plain::-webkit-scrollbar-thumb{background:rgba(160,124,44,.5);border-radius:5px}
.plain::-webkit-scrollbar-thumb:hover{background:rgba(140,43,43,.55)}
.plain h3{margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:.16em;
  color:#6e1b23}
.plain .edn{margin:0;font-style:italic;font-size:13px;color:#6b4c25}
.plain .ded{margin:16px auto 0;max-width:56ch;font-style:italic;color:#4a3620}
.plain hr{border:0;height:1px;background:rgba(181,139,52,.42);
  max-width:300px;margin:20px auto}
.plain dl{margin:0;padding:0}
.plain dt{margin:20px 0 1px;font-size:11.5px;font-weight:600;letter-spacing:.28em;
  text-transform:uppercase;color:#8c2b2b}
.plain dt small{display:block;margin-top:2px;font-size:12px;font-weight:400;
  letter-spacing:.02em;text-transform:none;font-style:italic;color:#6b4c25}
.plain dd{margin:5px 0 0;font-size:18px;color:#2b1e10}
.plain .colophon{margin:18px auto 0;max-width:62ch;font-size:13.5px;
  color:#5a422a;text-align:justify;hyphens:auto}
.plain .fleuron{color:rgba(181,139,52,.9);font-size:13px;margin-top:18px}

footer{display:flex;align-items:center;justify-content:center;gap:14px;
  flex-wrap:wrap;padding:11px 6px 2px}
button{appearance:none;background:none;border:0;
  border-bottom:1px solid rgba(160,124,44,.45);
  font:inherit;font-size:12px;letter-spacing:.15em;text-transform:uppercase;
  color:#6b4c25;padding:3px 1px;cursor:pointer;
  transition:color .2s,border-color .2s}
button:hover{color:#6e1b23;border-bottom-color:#8c2b2b}
button[aria-pressed="true"]{color:#6e1b23;border-bottom-color:#8c2b2b}
button:focus-visible{outline:1px dotted #b58b34;outline-offset:4px}
.sep{color:rgba(160,124,44,.7);font-size:11px;user-select:none}
.hint{width:100%;text-align:center;font-size:11px;font-style:italic;
  color:rgba(107,76,37,.72);margin-top:2px}

@media (max-width:620px){
  .frame{padding:12px 13px 10px;border-radius:13px}
  header{padding:0 30px 8px}
  h2{font-size:11.5px;letter-spacing:.26em}
  .tagline{font-size:11px}
  .corner{width:28px;height:28px}
  .plain{padding:20px 18px 24px;font-size:14px}
  .plain h3{font-size:18px}
  .plain dd{font-size:16px}
  footer{gap:10px}
  button{font-size:11px;letter-spacing:.1em}
  .sep{display:none}
}
@media (prefers-reduced-motion:reduce){
  .host,.frame{transition:none}
}
`;
