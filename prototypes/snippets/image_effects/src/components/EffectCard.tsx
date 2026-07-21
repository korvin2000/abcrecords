import type { GalleryItem } from "../data/gallery";

export default function EffectCard({ item }: { item: GalleryItem }) {
  const photo = (
    <img src={item.src} alt={item.alt} loading="lazy" className="aspect-[3/2]" />
  );

  return (
    <figure className="fx-card group flex flex-col gap-4">
      <div className={`fx ${item.effect}`}>
        {item.wrapped ? <div className="inner">{photo}</div> : photo}
        {item.polaroid && (
          <span className="fx-polaroid-caption">autumn coast ’25</span>
        )}
      </div>

      <figcaption className="px-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-wide text-zinc-100">
            {item.name}
          </span>
          {item.signature && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              ★ Signature
            </span>
          )}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
          {item.description}
        </p>
      </figcaption>
    </figure>
  );
}
