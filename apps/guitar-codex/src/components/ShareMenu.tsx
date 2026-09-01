import { useState, type ReactNode } from "react";
import { SITE } from "@/config";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import {
  copyLink,
  nativeShare,
  openSharePopup,
  SHARE_SERVICES,
  type ShareData,
} from "@/lib/share";

/**
 * The footer's share flyout — one row of marks for the networks this
 * catalogue's readers actually use, plus the platform's own share sheet where
 * there is one and "copy link" where there is not.
 *
 * **It slides out beneath the section grid rather than out of the tile that
 * opened it.** A panel anchored to the tile is the more usual shape, and it is
 * the wrong one here: on a phone the sections are a three-column grid and "VII"
 * sits hard against the left edge of it, so a centred popover wide enough for
 * eight marks hangs a good 30 px off the side of the screen at 320 px — and
 * every fix for that (flip, clamp, collision detection) is more machinery than
 * the whole feature is worth. Opening into the footer's own width has no edges
 * to collide with at any viewport, and reads as the menu unfolding rather than
 * as something covering it.
 *
 * The endpoints, the encoding and the popup are all in lib/share.ts; this file
 * is the drawing and nothing else.
 */

/** How the marks are drawn: one monoline emblem per service, in the chrome's
 *  own gold, rather than eight brand logos in eight brand colours. Exact
 *  trademarks would be the only saturated thing on a parchment page — and
 *  these are 20 px shapes, where a letterform reads better than a logo. */
const ICONS: Record<string, ReactNode> = {
  // "VK" — the two letters, monoline.
  vk: (
    <>
      <path d="M3 7.5 6.4 16.5 9.8 7.5" />
      <path d="M14 7.5v9" />
      <path d="M20.5 7.5 14.6 12l5.9 4.5" />
    </>
  ),
  // A paper plane.
  telegram: (
    <>
      <path d="M21.6 3.6 2.4 11a.5.5 0 0 0 .05.94l4.7 1.5 1.8 5.6a.5.5 0 0 0 .87.18l2.4-2.7 4.8 3.5a.5.5 0 0 0 .78-.3l3.5-15.5a.5.5 0 0 0-.7-.62z" />
      <path d="M7.15 13.44 19.2 6.1l-7.9 8.42-.4 4.4" />
    </>
  ),
  // A message bubble with a handset in it.
  whatsapp: (
    <>
      <path d="M12 2.9a9.1 9.1 0 0 0-7.8 13.8L2.9 21.1l4.6-1.25A9.1 9.1 0 1 0 12 2.9z" />
      <path d="M8.6 8.1c.28-.1.6.02.75.28l.85 1.4c.14.24.1.54-.1.73l-.6.58c-.1.1-.13.26-.06.4a6.4 6.4 0 0 0 2.9 2.9c.14.07.3.04.4-.06l.58-.6c.19-.2.49-.24.73-.1l1.4.85c.26.15.38.47.28.75-.3.85-1.2 1.4-2.1 1.28-3.1-.45-5.75-3.1-6.2-6.2-.12-.9.43-1.8 1.28-2.1z" />
    </>
  ),
  // The X mark.
  x: (
    <>
      <path d="M4.5 4.5 19.5 19.5" />
      <path d="M19.5 4.5 4.5 19.5" />
    </>
  ),
  // An "f".
  facebook: (
    <>
      <path d="M15.8 4.2h-1.9c-1.9 0-3.1 1.3-3.1 3.3v2.6H8.3" />
      <path d="M8.3 13.2h6.4" />
      <path d="M10.8 7.5v12.3" />
    </>
  ),
  // "OK".
  ok: (
    <>
      <ellipse cx="7" cy="12" rx="3.6" ry="4.5" />
      <path d="M15 7.5v9" />
      <path d="M21 7.5 15.6 12l5.4 4.5" />
    </>
  ),
  // A chain link — copy the address.
  copy: (
    <>
      <path d="M10.2 13.8a4.4 4.4 0 0 0 6.6.5l2.6-2.6a4.4 4.4 0 0 0-6.2-6.2l-1.5 1.5" />
      <path d="M13.8 10.2a4.4 4.4 0 0 0-6.6-.5l-2.6 2.6a4.4 4.4 0 0 0 6.2 6.2l1.5-1.5" />
    </>
  ),
  // The share sheet: three nodes on two threads.
  native: (
    <>
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="M8.3 10.8 15.7 6.7" />
      <path d="M8.3 13.2 15.7 17.3" />
    </>
  ),
};

function Mark({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="share-chip-mark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[id]}
    </svg>
  );
}

export function ShareMenu() {
  const { t } = useI18n();
  // Not a boolean: the line is `aria-live`, so it has to *change* to be read
  // out, and a failed copy has to say something other than nothing.
  const [notice, setNotice] = useState<string | null>(null);

  const data: ShareData = {
    url: SITE.url,
    title: t("app.title"),
    text: t("app.title"),
    description: t("app.subtitle"),
  };

  const share = (href: string) => {
    audio.click();
    openSharePopup(href);
  };

  // The sheet is offered first where the platform has one — it is the one
  // "share" that reaches the reader's own apps rather than a fixed list — and
  // the marks below stay on screen either way, so a cancelled sheet leaves
  // them exactly where they were (docs/social-share-i18n.md §8).
  const useSheet = typeof navigator !== "undefined" && Boolean(navigator.share);

  const openSheet = async () => {
    audio.click();
    await nativeShare(data);
  };

  const copy = async () => {
    audio.click();
    const ok = await copyLink(data.url);
    setNotice(ok ? t("share.copied") : data.url);
  };

  return (
    <div className="share-flyout" role="group" aria-label={t("share.menu")}>
      <ul className="share-row">
        {useSheet && (
          <li>
            <button type="button" className="share-chip" onClick={openSheet} title={t("share.native")} aria-label={t("share.native")}>
              <Mark id="native" />
            </button>
          </li>
        )}

        {SHARE_SERVICES.map((service) => {
          const href = service.build(data);
          return (
            <li key={service.id}>
              {/* A real `href`, so the control keeps working when the popup
                  is blocked and so a middle-click opens a tab (§7). */}
              <a
                className="share-chip"
                href={href}
                target="_blank"
                rel="nofollow noopener noreferrer"
                title={t(service.label)}
                aria-label={t(service.label)}
                onClick={(e) => {
                  e.preventDefault();
                  share(href);
                }}
                onMouseEnter={() => audio.hover()}
              >
                <Mark id={service.id} />
              </a>
            </li>
          );
        })}

        <li>
          <button type="button" className="share-chip" onClick={copy} title={t("share.copy")} aria-label={t("share.copy")}>
            <Mark id="copy" />
          </button>
        </li>
      </ul>

      <p className="share-notice" aria-live="polite">
        {notice ?? SITE.url.replace(/^https?:\/\//, "")}
      </p>
    </div>
  );
}
