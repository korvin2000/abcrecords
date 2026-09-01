import type { MsgKey } from "./messages";

/**
 * Sharing the project to the networks its readers actually use.
 *
 * The shape is the one docs/social-share-i18n.md argues for and the legacy
 * `share42` block got right by accident: **a registry of endpoints plus one
 * generic opener**, not a paragraph of `onclick` per service. What the old
 * block got wrong is everything else, and each of those is a rule here:
 *
 * - **Nothing is pre-encoded.** The dictionaries hold ordinary Unicode
 *   ("Поделиться во ВКонтакте"); `URLSearchParams` serialises it once, at the
 *   end. The legacy markup stored `%D0%9F%D1%80…` in the HTML, which is a
 *   translation you cannot read, cannot spell-check and cannot re-encode
 *   without double-encoding it (§4).
 * - **`https`, and current endpoints.** Odnoklassniki's `odnoklassniki.ru/dk
 *   ?st.cmd=addShare` is superseded by `connect.ok.ru/offer` (§5.5).
 * - **Dead services are absent, not commented out.** Google+ has been gone
 *   since 2019 and memori.ru could not be verified at all (§5.7, §5.8).
 * - **The preview card comes from the page, not from the query.** Only VK, OK
 *   and X read a title at all; Facebook takes the URL and reads the target's
 *   Open Graph tags (§5.2). Passing a title to Facebook has never been
 *   reliable and is not attempted.
 *
 * Mail.ru and LiveJournal are deliberately left out of the shipped set: the
 * guide files both under "legacy — verify before enabling", and a share button
 * that quietly opens a dead form is worse than no button.
 */

export interface ShareData {
  /** Canonical, absolute URL of what is being shared. */
  readonly url: string;
  /** Concise localized title. */
  readonly title: string;
  /** The message a reader is offered as their own words, where a service
   *  composes one. Defaults to the title. */
  readonly text?: string;
  /** Longer localized blurb, for the services that take one. */
  readonly description?: string;
}

export interface ShareService {
  readonly id: string;
  /** Label and accessible name; also the tooltip. */
  readonly label: MsgKey;
  readonly build: (data: ShareData) => string;
}

/** One encoder for the lot. Empty values are dropped rather than sent blank —
 *  `title=` is not the same request as no title at all. */
function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export const SHARE_SERVICES: readonly ShareService[] = [
  {
    id: "vk",
    label: "share.vk",
    build: (d) =>
      buildUrl("https://vk.com/share.php", {
        url: d.url,
        title: d.title,
        description: d.description,
      }),
  },
  {
    id: "telegram",
    label: "share.telegram",
    build: (d) => buildUrl("https://t.me/share/url", { url: d.url, text: d.text ?? d.title }),
  },
  {
    id: "whatsapp",
    label: "share.whatsapp",
    // One `text` field, so the message and the link have to travel together.
    build: (d) => buildUrl("https://api.whatsapp.com/send", { text: `${d.text ?? d.title} ${d.url}` }),
  },
  {
    id: "x",
    label: "share.x",
    // `twitter.com/intent` still redirects and still works; keeping the
    // endpoint here is precisely so it can be changed in one line when it
    // stops doing so (§5.3).
    build: (d) => buildUrl("https://twitter.com/intent/tweet", { text: d.text ?? d.title, url: d.url }),
  },
  {
    id: "facebook",
    label: "share.facebook",
    build: (d) => buildUrl("https://www.facebook.com/sharer/sharer.php", { u: d.url }),
  },
  {
    id: "ok",
    label: "share.ok",
    build: (d) => buildUrl("https://connect.ok.ru/offer", { url: d.url, title: d.title }),
  },
];

/**
 * Open a share endpoint in a centred popup, falling back to a tab.
 *
 * `noopener`/`noreferrer` are not optional here: without them the opened
 * window keeps a live `window.opener` handle back into this document.
 */
export function openSharePopup(url: string): void {
  const width = 640;
  const height = 620;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  window.open(
    url,
    "_blank",
    `popup=yes,noopener=yes,noreferrer=yes,resizable=yes,scrollbars=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
}

/**
 * The platform's own share sheet, where there is one.
 *
 * Returns false when the browser has no `navigator.share`, when the page is
 * not in a secure context, or when the call failed for any reason other than
 * the reader changing their mind — in every one of those cases the caller
 * should show the menu instead. A cancelled sheet counts as handled: the
 * reader has already answered.
 */
export async function nativeShare(data: ShareData): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({ title: data.title, text: data.text ?? data.description, url: data.url });
    return true;
  } catch (error) {
    return (error as Error | undefined)?.name === "AbortError";
  }
}

/** Copy to the clipboard, with the pre-`navigator.clipboard` fallback still in
 *  place — `writeText` needs a secure context, and the site is also read over
 *  plain http from the archive. */
export async function copyLink(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* denied, or no permission in this context — try the old way */
  }
  try {
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
