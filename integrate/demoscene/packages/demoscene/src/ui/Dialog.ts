import type { DemosceneContent, DemosceneOptions, ResolvedContent, DemosceneMessages } from '../types';
import { DEFAULT_CONTENT } from '../content/defaultContent';
import { detectLocale, resolveContent, resolveMessages } from '../i18n';
import { clamp, escapeHtml } from '../core/util';
import { Chiptune } from '../audio/Chiptune';
import { SONG } from '../audio/score';
import { Stage } from '../render/Stage';
import { cornersHtml, CSS } from './styles';

const FOCUSABLE =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

function plainHtml(c: ResolvedContent): string {
  const out: string[] = [
    `<h3>${escapeHtml(c.work)}</h3>`,
    `<p class="edn">${escapeHtml(c.edition)}</p>`,
    `<p class="ded">${escapeHtml(c.dedication)}</p>`,
    '<hr>',
    '<dl>',
  ];
  for (const g of c.credits) {
    out.push(
      `<dt>${escapeHtml(g.role)}${g.sub ? `<small>${escapeHtml(g.sub)}</small>` : ''}</dt>`,
    );
    for (const n of g.names) out.push(`<dd>${escapeHtml(n)}</dd>`);
  }
  out.push(
    '</dl>',
    '<hr>',
    `<p class="colophon">${escapeHtml(c.colophon)}</p>`,
    '<p class="fleuron">❦</p>',
  );
  return out.join('');
}

function mergeContent(over?: Partial<DemosceneContent>): DemosceneContent {
  return { ...DEFAULT_CONTENT, ...(over ?? {}) } as DemosceneContent;
}

/**
 * The demoscene itself: a shadow root the host application cannot reach into,
 * owning one `Stage` and one `Chiptune`.
 *
 * Private implementation. The host never sees this class -- `DemosceneApp`
 * (React) and `createDemoscene` (imperative) are thin wrappers over it, and
 * they are the whole public surface.
 *
 * Framework-agnostic on purpose: React owns *when* it exists, not what it
 * does. Everything it touches outside its own subtree -- the AudioContext,
 * the row timer, the rAF loop, the visibilitychange and resize listeners, the
 * ResizeObserver, `document.body.style.overflow`, the close-transition
 * timeout and the mount node itself -- is released by `destroy()`, which is
 * what the component calls on unmount (architecture guide 23).
 */
export class Dialog {
  private opts: DemosceneOptions;
  private content!: ResolvedContent;
  private msg!: DemosceneMessages;

  private mount: HTMLDivElement | null = null;
  private sr: ShadowRoot | null = null;
  private hostEl!: HTMLDivElement;
  private frame!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private plain!: HTMLDivElement;
  private btn: Record<string, HTMLButtonElement> = {};

  private stage: Stage | null = null;
  private tune: Chiptune;
  private ro: ResizeObserver | null = null;
  private onWinResize: (() => void) | null = null;
  private onVis: (() => void) | null = null;
  private lastFocus: Element | null = null;
  private prevOverflow = '';
  private hideTimer = 0;

  isOpen = false;
  textMode = false;
  musicOn = false;
  readonly reduced: boolean;

  constructor(opts: DemosceneOptions = {}) {
    this.opts = opts;
    this.tune = new Chiptune(opts.volume ?? 0.62);
    this.reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resolve();
  }

  private resolve(): void {
    const locale = this.opts.locale ?? detectLocale();
    const fallback = this.opts.fallbackLocale ?? 'en';
    this.content = resolveContent(mergeContent(this.opts.content), locale, fallback);
    this.msg = resolveMessages(this.opts.messages ?? {}, locale, fallback);
  }

  /**
   * Replace options -- a locale swap is the usual reason. Every piece of
   * display type is a baked bitmap, so this rebuilds rather than re-renders.
   *
   * An open dialog is closed first, not rebuilt underneath itself: `open()`
   * records the body's *current* `overflow` as the value to put back on
   * close, so re-opening over a live scroll lock would record `'hidden'` as
   * the host's own value and strand it there forever.
   */
  update(opts: DemosceneOptions): void {
    const wasOpen = this.isOpen;
    this.opts = { ...this.opts, ...opts };
    this.resolve();
    if (opts.volume !== undefined) this.tune.setVolume(opts.volume);
    if (!this.mount) return;
    if (wasOpen) this.close(true);
    this.teardownDom();
    if (wasOpen) this.open(true);
  }

  /* ------------------------------------------------------------- build */

  private build(): void {
    if (this.mount) return;
    const mount = document.createElement('div');
    mount.setAttribute('data-feature', 'demoscene');
    this.mount = mount;
    const sr = mount.attachShadow({ mode: 'open' });
    this.sr = sr;

    const style = document.createElement('style');
    style.textContent = CSS;
    sr.appendChild(style);

    const host = document.createElement('div');
    host.className = 'host';
    host.innerHTML = `
      <div class="scrim" part="scrim"></div>
      <div class="frame" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        this.msg.dialogLabel,
      )}" tabindex="-1">
        ${cornersHtml()}
        <header>
          <h2>${escapeHtml(this.content.title)}</h2>
          <p class="tagline">${escapeHtml(this.content.subtitle)}</p>
          <div class="rule"><i></i><b>❖</b><i></i></div>
        </header>
        <div class="stage">
          <canvas aria-label="${escapeHtml(this.msg.canvasLabel)}"></canvas>
          <div class="plain" role="document" tabindex="0">${plainHtml(this.content)}</div>
        </div>
        <footer>
          <button data-a="music" aria-pressed="false">${escapeHtml(this.msg.music)}</button>
          <span class="sep">·</span>
          <button data-a="text" aria-pressed="false">${escapeHtml(this.msg.text)}</button>
          <span class="sep">·</span>
          <button data-a="restart">${escapeHtml(this.msg.restart)}</button>
          <span class="sep">·</span>
          <button data-a="close">${escapeHtml(this.msg.close)}</button>
          <p class="hint">${escapeHtml(this.msg.hint)}</p>
        </footer>
      </div>`;
    sr.appendChild(host);

    this.hostEl = host;
    this.frame = host.querySelector('.frame') as HTMLDivElement;
    this.canvas = host.querySelector('canvas') as HTMLCanvasElement;
    this.plain = host.querySelector('.plain') as HTMLDivElement;

    this.btn = {};
    host.querySelectorAll('button').forEach((b) => {
      const key = b.getAttribute('data-a') ?? '';
      this.btn[key] = b as HTMLButtonElement;
      b.addEventListener('click', () => this.act(key));
    });
    (host.querySelector('.scrim') as HTMLElement).addEventListener('click', () =>
      this.close(),
    );
    host.addEventListener('keydown', this.onKey);

    this.onVis = () => {
      if (!this.isOpen) return;
      if (document.hidden) this.suspend();
      else this.resume();
    };
    document.addEventListener('visibilitychange', this.onVis);

    this.stage = new Stage(this.canvas, this.content, this.tune, this.opts.maxDpr ?? 1.6);

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(this.canvas);
    } else {
      this.onWinResize = () => this.fit();
      window.addEventListener('resize', this.onWinResize);
    }

    document.body.appendChild(mount);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'm' || e.key === 'M') this.act('music');
    else if (e.key === 't' || e.key === 'T') this.act('text');
    else if (e.key === 'r' || e.key === 'R') this.act('restart');
    else if (e.key === 'Tab') this.trap(e);
  };

  private trap(e: KeyboardEvent): void {
    const list = this.frame.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = this.sr?.activeElement ?? document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private fit(): void {
    if (!this.stage) return;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 4);
    this.stage.resize(r.width, r.height, dpr);
    if (!this.stage.running) this.stage.render(this.tune.clock());
  }

  private act(what: string): void {
    if (what === 'close') this.close();
    else if (what === 'music') this.setMusic(!this.musicOn);
    else if (what === 'text') this.setText(!this.textMode);
    else if (what === 'restart') {
      this.tune.start(0);
      this.stage?.resetStave();
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on && !this.tune.enableAudio()) this.musicOn = false;
    if (!on) this.tune.disableAudio();
    const b = this.btn.music;
    if (b) {
      b.setAttribute('aria-pressed', this.musicOn ? 'true' : 'false');
      b.textContent = this.musicOn ? this.msg.musicOn : this.msg.music;
    }
  }

  setText(on: boolean): void {
    this.textMode = on;
    this.plain.classList.toggle('on', on);
    this.btn.text?.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.canvas.setAttribute('aria-hidden', on ? 'true' : 'false');
    if (on) {
      this.stage?.stop();
      this.plain.focus();
    } else {
      this.stage?.start();
      this.frame.focus();
    }
  }

  private suspend(): void {
    this.stage?.stop();
    this.tune.stop();
  }

  private resume(): void {
    if (!this.textMode) this.stage?.start();
    this.tune.start(this.tune.row % SONG.rows);
    if (this.musicOn) this.tune.enableAudio();
  }

  /* -------------------------------------------------------- open/close */

  open(silent = false): void {
    if (this.isOpen) return;
    this.build();
    this.isOpen = true;
    this.lastFocus = document.activeElement;
    this.hostEl.style.display = '';
    this.prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.fit();

    this.tune.start(0);
    this.setMusic(!!(this.opts.autoMusic ?? true) && !this.reduced);
    this.setText(this.reduced);
    if (!this.reduced) this.stage?.start();

    requestAnimationFrame(() => {
      this.hostEl.classList.add('in');
      (this.reduced ? this.plain : this.frame).focus();
    });
    if (!silent) this.opts.onOpen?.();
  }

  /**
   * `silent` suppresses the `onClose` callback. Teardown and programmatic
   * closes must never call back into the host: React StrictMode unmounts and
   * remounts every effect in development, and a teardown that reports itself
   * as a user-initiated close makes a controlled parent set `open` back to
   * false the instant it set it to true.
   */
  close(silent = false): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.hostEl.classList.remove('in');
    this.stage?.stop();
    this.tune.disableAudio();
    this.tune.stop();
    document.body.style.overflow = this.prevOverflow;
    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      if (!this.isOpen && this.hostEl) this.hostEl.style.display = 'none';
    }, 400);
    if (this.lastFocus instanceof HTMLElement) {
      try {
        this.lastFocus.focus();
      } catch {
        /* the trigger may have been removed */
      }
    }
    if (!silent) this.opts.onClose?.();
  }

  private teardownDom(): void {
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = 0;
    }
    this.ro?.disconnect();
    this.ro = null;
    if (this.onWinResize) window.removeEventListener('resize', this.onWinResize);
    this.onWinResize = null;
    if (this.onVis) document.removeEventListener('visibilitychange', this.onVis);
    this.onVis = null;
    this.stage?.stop();
    this.stage = null;
    this.mount?.parentNode?.removeChild(this.mount);
    this.mount = null;
    this.sr = null;
  }

  destroy(): void {
    this.close(true);
    this.teardownDom();
    this.tune.dispose();
  }
}
