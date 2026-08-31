/** Shown while an entry's edition loads. Deliberately not a spinner: the card
 *  click already warmed the fetch, so this is usually a single frame. */
export function CodexSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-5 w-full rounded" />
      <div className="skeleton h-5 w-5/6 rounded" />
      <div className="skeleton mt-6 h-40 w-full rounded" />
    </div>
  );
}
