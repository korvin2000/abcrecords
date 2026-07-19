import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { audio } from "@/lib/audioEngine";
import { RARITY_STYLES, type Character } from "@/types/character";
import { OrnateFrame, RarityStars } from "./OrnateFrame";

interface Props {
  character: Character;
  onSelect: (id: string) => void;
}

export function CharacterCard({ character, onSelect }: Props) {
  const { meta } = character;
  const rarity = RARITY_STYLES[meta.rarity];
  const isWanderer = meta.id.startsWith("wanderer-");

  // pointer-driven tilt
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 180, damping: 16, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [11, -11]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-11, 11]), spring);

  // cursor glare
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,247,224,0.28), transparent 45%)`;

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.button
      type="button"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={() => audio.hover()}
      onClick={() => {
        audio.click();
        window.setTimeout(() => onSelect(meta.id), 70);
      }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.045 }}
      whileTap={{ scale: 0.97 }}
      className="group preserve-3d relative block w-full cursor-pointer text-left"
      aria-label={`Open ${meta.firstName} ${meta.surname}`}
    >
      <OrnateFrame accent={rarity.border}>
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gold-500/20 bg-ink-900"
          style={{ ["--glow" as string]: rarity.glow }}
        >
          {/* portrait */}
          <img
            src={character.portrait}
            alt={meta.firstName}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-110"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {/* colour grade */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/35 to-transparent" />
          <div
            className="absolute inset-0 mix-blend-soft-light opacity-50"
            style={{ background: `radial-gradient(120% 80% at 50% 0%, ${meta.accent}55, transparent 60%)` }}
          />

          {/* hover glow ring */}
          <div
            className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ boxShadow: `inset 0 0 0 1.5px ${rarity.border}, 0 14px 50px ${rarity.glow}` }}
          />

          {/* cursor glare */}
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glare }}
          />

          {/* shine sweep */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
          </span>

          {/* top badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <div className="flex flex-col gap-1">
              <span
                className="rounded-md px-1.5 py-0.5 font-heading text-[0.6rem] font-bold uppercase tracking-wider text-ink-950"
                style={{ backgroundColor: rarity.border }}
              >
                {meta.archetype}
              </span>
              <span className="w-fit rounded-md border border-white/15 bg-ink-950/60 px-1.5 py-0.5 font-heading text-[0.55rem] uppercase tracking-wider text-parchment/80 backdrop-blur-sm">
                {meta.element}
              </span>
            </div>
            <RarityStars count={rarity.stars} accent={rarity.border} />
          </div>

          {isWanderer && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="rounded-full border border-mystic-300/60 bg-ink-950/70 px-2 py-0.5 font-heading text-[0.55rem] uppercase tracking-[0.2em] text-mystic-300 backdrop-blur">
                ◈ Summoned ◈
              </span>
            </div>
          )}

          {/* name plate */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="font-heading text-lg font-bold leading-tight text-gold-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-xl">
              {meta.firstName}{" "}
              <span className="text-gold-300">{meta.surname}</span>
            </h3>
            <p className="mt-0.5 truncate font-body text-xs italic text-parchment/70">
              {meta.title}
            </p>
          </div>
        </div>
      </OrnateFrame>
    </motion.button>
  );
}
