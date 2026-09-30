/**
 * A damped spring, and nothing else.
 *
 * The catalogue card's tilt is the one animation in the app that is genuinely
 * physical: it follows the pointer with inertia, overshoots a little and
 * settles, and it can be redirected mid-flight. A CSS transition cannot do
 * that — it restarts from rest on every change — so the card keeps a real
 * spring. This is the whole of it: the same stiffness / damping / mass model
 * the animation library used, integrated by hand, so the numbers in
 * components/CharacterCard.tsx mean what they always meant.
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  /** Below this distance *and* speed the spring is taken to have arrived. In
   *  the value's own units — degrees, pixels, a scale factor. */
  restDelta: number;
}

/** Integration step, in seconds. Small enough to be stable for any spring the
 *  app configures; a frame is advanced in as many of these as it needs. */
const STEP = 1 / 240;
/** A frame longer than this (a background tab coming back) is not simulated in
 *  full — the spring would otherwise leap. */
const MAX_FRAME = 1 / 20;

export class Spring {
  value: number;
  target: number;
  private velocity = 0;
  private readonly config: SpringConfig;

  constructor(initial: number, config: SpringConfig) {
    this.value = initial;
    this.target = initial;
    this.config = config;
  }

  /** Advance by `dt` seconds. Returns true once the spring is at rest. */
  step(dt: number): boolean {
    const { stiffness, damping, mass, restDelta } = this.config;
    let remaining = Math.min(dt, MAX_FRAME);

    // Semi-implicit Euler: velocity first, then position from the new
    // velocity — stable where the explicit form gains energy.
    while (remaining > 0) {
      const h = Math.min(STEP, remaining);
      const force = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += (force / mass) * h;
      this.value += this.velocity * h;
      remaining -= h;
    }

    if (Math.abs(this.value - this.target) < restDelta && Math.abs(this.velocity) < restDelta) {
      this.value = this.target;
      this.velocity = 0;
      return true;
    }
    return false;
  }
}
