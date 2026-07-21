import EffectCard from "./components/EffectCard";
import { gallery } from "./data/gallery";

export default function App() {
  return (
    <div className="min-h-screen text-zinc-200 antialiased">
      <header className="mx-auto max-w-6xl px-6 pt-16 pb-4 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">
          Frame &amp; Canvas Lab
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Photo Effect Gallery
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Twelve ways to dress the same canvas — rounded corners, darkened or
          lightened rims, glossy sheens, bevels and glows. Each miniature wears
          its own frame effect; hover any photo to give it a gentle{" "}
          <span className="text-zinc-200">+7% of volume</span>.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
        <div className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((item) => (
            <EffectCard key={item.id} item={item} />
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-500">
        Photos from Pexels · Effects rendered with pure CSS — gradients, inset
        shadows &amp; 3D transforms
      </footer>
    </div>
  );
}
