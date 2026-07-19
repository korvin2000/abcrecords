// ============================================================
//  ParticleField — a lightweight, pooled canvas particle system.
//
//  Game-dev techniques used:
//    • object pooling (no per-frame allocations)
//    • fixed-timestep-ish rAF loop with delta
//    • devicePixelRatio aware rendering
//    • additive ('lighter') blending for a luminous look
//    • depth-based parallax + twinkle
// ============================================================

const TAU = Math.PI * 2;

interface Particle {
  x: number;
  y: number;
  z: number; // depth 0..1 (parallax + size)
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  twinkle: number;
  active: boolean;
}

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: Particle[] = [];
  private active: Particle[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private spawnAcc = 0;
  private running = false;
  private maxParticles = 130;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push(this.makeParticle(true));
    }
  }

  private makeParticle(dormant: boolean): Particle {
    return {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      hue: 42,
      twinkle: 0,
      active: !dormant,
    };
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    this.last = performance.now();
    // seed a field immediately
    for (let i = 0; i < 60; i++) this.spawn(Math.random() * this.h);
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(48, now - this.last);
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
    } else if (this.running) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => {
        const loop = (now: number) => {
          if (!this.running) return;
          const dt = Math.min(48, now - this.last);
          this.last = now;
          this.step(dt);
          this.raf = requestAnimationFrame(loop);
        };
        this.last = t;
        this.raf = requestAnimationFrame(loop);
      });
    }
  };

  private obtain(): Particle | null {
    const p = this.pool.pop();
    if (p) {
      p.active = true;
      this.active.push(p);
      return p;
    }
    return null;
  }

  private release(p: Particle) {
    p.active = false;
    const i = this.active.indexOf(p);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(p);
  }

  private spawn(startY?: number) {
    const p = this.obtain();
    if (!p) return;
    const z = Math.random();
    p.z = z;
    p.x = Math.random() * this.w;
    p.y = startY ?? this.h + 12;
    p.vx = (Math.random() - 0.5) * 0.18 * (0.4 + z);
    p.vy = -(0.12 + z * 0.55) - Math.random() * 0.12;
    p.maxLife = 6000 + Math.random() * 9000;
    p.life = p.maxLife;
    p.size = (0.6 + z * 2.4) * (0.8 + Math.random() * 0.6);
    // bias hue toward gold, with occasional teal / violet embers
    const roll = Math.random();
    p.hue = roll < 0.7 ? 42 + Math.random() * 10 : roll < 0.85 ? 170 + Math.random() * 14 : 265 + Math.random() * 14;
    p.twinkle = Math.random() * TAU;
  }

  private step(dtMs: number) {
    const dt = dtMs / 16.6667; // normalise to ~60fps units
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "lighter";

    // spawn rate
    this.spawnAcc += dt;
    while (this.spawnAcc > 1.2 && this.active.length < this.maxParticles) {
      this.spawn();
      this.spawnAcc -= 1.2;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.twinkle += 0.05 * dt;
      p.life -= dtMs;
      if (p.life <= 0 || p.y < -20) {
        this.release(p);
        continue;
      }
      const t = p.life / p.maxLife; // 1 → 0
      const fadeIn = Math.min(1, (1 - t) * 6); // fade in fast
      const fadeOut = Math.min(1, t * 2.2);
      const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut)) * (0.5 + 0.5 * Math.sin(p.twinkle)) * (0.5 + p.z * 0.5);
      const r = p.size;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      grad.addColorStop(0, `hsla(${p.hue}, 95%, 70%, ${alpha})`);
      grad.addColorStop(0.4, `hsla(${p.hue}, 90%, 60%, ${alpha * 0.4})`);
      grad.addColorStop(1, `hsla(${p.hue}, 90%, 60%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 4, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }
}
