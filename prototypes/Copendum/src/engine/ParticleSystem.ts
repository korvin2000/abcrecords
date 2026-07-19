// Canvas-based floating ember / rune particle system.
// Uses a simple verlet-like drift with size/alpha modulation for "embers rising from a fire".

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
  glyph?: string;
}

const GLYPHS = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛈ", "ᛉ", "ᛊ", "ᛏ"];

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private running = false;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    window.addEventListener("resize", this.resize);
    this.last = performance.now();
    this.loop(this.last);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
  }

  private spawn(): Particle {
    // ~30% of particles are runes, the rest are embers
    const isRune = Math.random() < 0.25;
    const maxLife = 6000 + Math.random() * 6000;
    return {
      x: Math.random() * this.width,
      y: this.height + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.15 + Math.random() * 0.5),
      size: isRune ? 14 + Math.random() * 14 : 1 + Math.random() * 2.5,
      life: maxLife,
      maxLife,
      hue: isRune ? 40 + Math.random() * 20 : 15 + Math.random() * 25,
      glyph: isRune ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : undefined,
    };
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(50, now - this.last);
    this.last = now;

    // Spawn new particles
    const spawnRate = 0.4 + (this.width * this.height) / 2500000;
    const target = Math.floor(spawnRate * (dt / 16));
    for (let i = 0; i < target; i++) {
      if (this.particles.length < 140) this.particles.push(this.spawn());
    }

    // Clear with slight trail
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = "lighter";

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.y < -20) {
        this.particles.splice(i, 1);
        continue;
      }
      // Gentle sway
      p.vx += (Math.random() - 0.5) * 0.04;
      p.vx *= 0.98;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);

      const t = p.life / p.maxLife;
      const alpha = Math.sin(t * Math.PI) * 0.8;

      if (p.glyph) {
        this.ctx.globalCompositeOperation = "lighter";
        this.ctx.font = `${p.size}px "MedievalSharp", serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha * 0.7})`;
        this.ctx.shadowColor = `hsla(${p.hue}, 90%, 60%, ${alpha})`;
        this.ctx.shadowBlur = 12;
        this.ctx.fillText(p.glyph, p.x, p.y);
        this.ctx.shadowBlur = 0;
      } else {
        const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${alpha})`);
        gradient.addColorStop(0.4, `hsla(${p.hue}, 100%, 50%, ${alpha * 0.6})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.globalCompositeOperation = "source-over";
    this.raf = requestAnimationFrame(this.loop);
  };
}
