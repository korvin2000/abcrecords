import { useEffect, useRef } from "react";
import { ParticleSystem } from "../engine/ParticleSystem";

export function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sysRef = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const sys = new ParticleSystem(ref.current);
    sysRef.current = sys;
    sys.start();
    return () => sys.stop();
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
    />
  );
}
