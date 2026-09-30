import { Spring, type SpringConfig } from "./spring";

/**
 * The catalogue card's pointer tilt: the card leans towards the cursor, lifts
 * and grows a little on hover, dips when pressed, and a warm glare follows the
 * pointer across the portrait.
 *
 * One function, attached to one element, and **no work at all while the
 * pointer is elsewhere**: listeners are passive bookkeeping, and the only
 * per-frame loop runs while a spring is actually moving, then stops. Forty
 * cards on screen cost forty sets of listeners and zero frames.
 *
 * The numbers are the ones the card has always had — it used to get them from
 * an animation library's `useSpring` / `whileHover` / `whileTap`.
 */

/** Lean, in degrees, at the card's edge. */
const MAX_TILT = 12;
const PERSPECTIVE = 720;
const HOVER_LIFT = -8;
const HOVER_SCALE = 1.045;
const PRESS_SCALE = 0.97;

/** The tilt follows the pointer on this spring… */
const TILT: Omit<SpringConfig, "restDelta"> = { stiffness: 95, damping: 18, mass: 0.7 };
/** …and the lift, the grow and the press on this slightly softer one. */
const HOVER: Omit<SpringConfig, "restDelta"> = { stiffness: 90, damping: 18, mass: 0.7 };

/** The glare is set as a whole gradient so the card body can simply paint
 *  `var(--card-glare, transparent)` without knowing where the pointer is. */
const glareAt = (x: number, y: number) =>
  `radial-gradient(circle at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, rgba(251,243,210,0.5), transparent 46%)`;

/**
 * Attach the tilt to `el`. Returns the function that detaches it and puts the
 * element back exactly as it was.
 */
export function attachTilt(el: HTMLElement): () => void {
  const rotateX = new Spring(0, { ...TILT, restDelta: 0.01 });
  const rotateY = new Spring(0, { ...TILT, restDelta: 0.01 });
  const lift = new Spring(0, { ...HOVER, restDelta: 0.01 });
  const scale = new Spring(1, { ...HOVER, restDelta: 0.0005 });

  let hovered = false;
  let pressed = false;
  let frame = 0;
  let last = 0;

  const paint = () => {
    const atRest = rotateX.value === 0 && rotateY.value === 0 && lift.value === 0 && scale.value === 1;
    // No transform at rest, rather than an identity one: a transform — even
    // `none`-equivalent — makes the card a stacking context and a compositor
    // layer, and forty idle cards should be neither.
    el.style.transform = atRest
      ? ""
      : `perspective(${PERSPECTIVE}px) translateY(${lift.value.toFixed(2)}px) scale(${scale.value.toFixed(4)}) ` +
        `rotateX(${rotateX.value.toFixed(2)}deg) rotateY(${rotateY.value.toFixed(2)}deg)`;
  };

  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    // Every spring is stepped every frame — `&&` would stop at the first one
    // still moving and freeze the rest.
    const settled = [rotateX.step(dt), rotateY.step(dt), lift.step(dt), scale.step(dt)].every(Boolean);
    paint();
    frame = settled ? 0 : requestAnimationFrame(tick);
  };

  const wake = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const retarget = () => {
    lift.target = hovered ? HOVER_LIFT : 0;
    scale.target = pressed ? PRESS_SCALE : hovered ? HOVER_SCALE : 1;
    wake();
  };

  const onMove = (e: MouseEvent) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    rotateX.target = (0.5 - y) * 2 * MAX_TILT;
    rotateY.target = (x - 0.5) * 2 * MAX_TILT;
    el.style.setProperty("--card-glare", glareAt(x, y));
    wake();
  };

  // A touch on a hybrid device fires pointerenter too; a finger does not
  // hover, and a card left "lifted" after a tap has nothing to lower it.
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    hovered = true;
    retarget();
  };

  const onLeave = () => {
    hovered = false;
    pressed = false;
    rotateX.target = 0;
    rotateY.target = 0;
    el.style.setProperty("--card-glare", glareAt(0.5, 0.5));
    retarget();
  };

  // The press is the primary button's: a right-click opens a menu, it does
  // not push the card in.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pressed = true;
    retarget();
  };

  const onUp = () => {
    pressed = false;
    retarget();
  };

  el.addEventListener("mousemove", onMove, { passive: true });
  el.addEventListener("pointerenter", onEnter, { passive: true });
  el.addEventListener("pointerleave", onLeave, { passive: true });
  el.addEventListener("pointerdown", onDown, { passive: true });
  el.addEventListener("pointerup", onUp, { passive: true });
  el.addEventListener("pointercancel", onUp, { passive: true });

  return () => {
    cancelAnimationFrame(frame);
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.style.transform = "";
    el.style.removeProperty("--card-glare");
  };
}
