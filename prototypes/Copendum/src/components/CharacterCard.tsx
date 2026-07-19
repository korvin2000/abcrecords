import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import type { Character } from "../engine/Character";
import { AppEvents, bus } from "../engine/EventBus";

interface Props {
  character: Character;
  onSelect: (id: string) => void;
  index: number;
}

export function CharacterCard({ character, onSelect, index }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), {
    stiffness: 200,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), {
    stiffness: 200,
    damping: 20,
  });

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
    setGlarePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 1,
    });
  };

  const handleLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  };

  const handleHover = () => bus.emit(AppEvents.CARD_HOVER, character.id);
  const handleClick = () => {
    bus.emit(AppEvents.CARD_SELECT, character.id);
    onSelect(character.id);
  };

  const c = character.data;
  const m = character.metadata;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      layout
      className="card-tilt group"
      style={{ perspective: 1000 }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onMouseEnter={handleHover}
        onClick={handleClick}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative cursor-pointer"
        whileHover={{ scale: 1.03 }}
      >
        {/* Card body */}
        <div className="ornate-border relative overflow-hidden rounded-sm bg-gradient-to-b from-[#1a0f08] via-[#120a06] to-[#0a0604]">
          {/* Portrait */}
          <div className="relative aspect-[3/4] w-full overflow-hidden">
            <img
              src={c.portrait}
              alt={character.fullName}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              loading="lazy"
            />
            {/* Vignette */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, transparent 40%, rgba(10,6,4,0.9) 100%)",
              }}
            />
            {/* Accent tint */}
            <div
              className="absolute inset-0 mix-blend-overlay opacity-40 transition duration-500 group-hover:opacity-60"
              style={{
                background: `radial-gradient(circle at 50% 30%, ${c.accent} 0%, transparent 60%)`,
              }}
            />
            {/* Glare overlay */}
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,210,80,0.35), transparent 50%)`,
                opacity: glarePos.opacity,
              }}
            />

            {/* Class badge */}
            <div
              className="absolute left-3 top-3 rounded-sm border border-amber-400/60 bg-black/70 px-2 py-1 font-display text-[10px] tracking-widest text-amber-300 backdrop-blur"
            >
              LVL {c.level} · {c.class.toUpperCase()}
            </div>

            {/* Name plate at bottom */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <h3
                className="rune-title font-display text-lg font-bold tracking-wider text-amber-200"
                style={{ textShadow: `0 0 12px ${c.accent}, 0 0 2px #000` }}
              >
                {m.firstName}
              </h3>
              <h3 className="rune-title font-display text-lg font-bold tracking-wider text-amber-100">
                {m.surname}
              </h3>
              <p className="mt-0.5 font-accent text-xs italic text-amber-100/70">
                {m.nationality} · {m.gender} · age {m.age}
              </p>
            </div>
          </div>

          {/* Bottom strip with power rating */}
          <div className="flex items-center justify-between border-t border-amber-400/30 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
              <span className="font-display text-[10px] tracking-widest text-amber-300/80">
                {c.alignment}
              </span>
            </div>
            <div className="font-display text-[10px] tracking-widest text-amber-300">
              PWR {character.powerRating}
            </div>
          </div>
        </div>

        {/* Name label below card */}
        <div className="mt-3 text-center">
          <p className="font-accent text-sm italic text-amber-200/90">
            "{c.quote.slice(0, 50)}{c.quote.length > 50 ? "…" : ""}"
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
