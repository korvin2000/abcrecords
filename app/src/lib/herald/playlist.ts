import type { AnniversaryMessage, HeraldMessage, QuoteMessage } from "./types";

/**
 * The rotation order.
 *
 * With both pools filled the block alternates — anniversary, saying,
 * anniversary, saying — walking each pool at its own pace, which is why the
 * shorter one repeats. With only one pool filled it simply cycles through it.
 * With neither, the list is empty and the caller keeps the default line
 * (and, having nothing to rotate to, starts no timer at all).
 *
 * `quoteOffset` rotates the sayings so two visits on the same day do not open
 * on the same one; it is picked once per visit by the caller, never here, so
 * this function stays pure and the order stays stable across re-renders.
 */
export function buildPlaylist(
  anniversaries: readonly AnniversaryMessage[],
  quotes: readonly QuoteMessage[],
  quoteOffset = 0,
): HeraldMessage[] {
  const rotated = rotate(quotes, quoteOffset);

  if (!anniversaries.length) return [...rotated];
  if (!rotated.length) return [...anniversaries];

  const rounds = Math.max(anniversaries.length, rotated.length);
  const playlist: HeraldMessage[] = [];
  for (let i = 0; i < rounds; i++) {
    playlist.push(anniversaries[i % anniversaries.length]);
    playlist.push(rotated[i % rotated.length]);
  }
  return playlist;
}

function rotate<T>(items: readonly T[], offset: number): readonly T[] {
  if (items.length < 2) return items;
  const at = ((offset % items.length) + items.length) % items.length;
  return at === 0 ? items : [...items.slice(at), ...items.slice(0, at)];
}
