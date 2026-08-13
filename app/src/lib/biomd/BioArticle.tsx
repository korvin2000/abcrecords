import { memo, useMemo, type MouseEventHandler, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { remarkHighlight } from "./remarkHighlight";
import { remarkZeroPaddedLists } from "./remarkZeroPaddedLists";
import { remarkVerse } from "./remarkVerse";
import { anchorElementId, anchorLinkTarget, scrollToAnchor } from "./anchors";
import type {
  BioDoc,
  BioNode,
  ContentAlignment,
  DocumentNode,
  FrameTone,
  ImageNode,
  NavNode,
  Tracks,
} from "./parse";
import { isExternalUrl, resolveResourcePath } from "../paths";
import { entryTargetSlug } from "../entry";
import { audioKind } from "../playback";
import { isImageUrl, useImageViewer } from "../imageViewer";
import { isAsciiTabUrl } from "../asciiTab";
import { useAsciiTabViewer } from "../asciiTabViewer";
import { useI18n } from "../i18n";
import { InlineAudioPlayer } from "@/components/AudioPlayer";
import { CurlFrame } from "@/components/CurlFrame";

/**
 * BioMD Lite → React renderer (docs/Biography-Markup.md, v1.6).
 * Plain-markdown runs go through react-markdown (GFM tables, quotes, footnotes)
 * plus the ==highlight==, zero-padded-list and verse plugins; layout blocks
 * render as dedicated components. Everything stays readable in source order
 * (mobile stacks floats, grids and columns).
 */

interface ArticleProps {
  /** Parsed once by the caller — the codex plate reads its titles too. */
  doc: BioDoc;
  /** Called with the slug when a link to another catalogue entry is clicked
   *  (`#/slug`, `x.bio.md` or `x.md` — docs/Biography-Markup.md §3.6). */
  onNavigateEntry?: (slug: string) => void;
  /** The document's `# ` line(s) that the codex plate is *not* showing, so the
   *  article prints them itself (see headings.ts). Normally empty. */
  titles?: readonly string[];
}

// remarkVerse runs last on purpose: by then the inline plugins have seen the
// tree, so a fenced verse keeps the literal text it was fenced with (spec 3.9).
const REMARK_PLUGINS = [remarkGfm, remarkHighlight, remarkZeroPaddedLists, remarkVerse];

/**
 * Present when this Markdown island is the body of a `::: nav` menu. It keeps
 * page links working exactly as in prose while suppressing the media widgets
 * (players, viewers) that make no sense inside a link bar, and marks the
 * current item — named by `active` or written as plain text — as current
 * instead of clickable (spec 10).
 */
interface NavContext {
  active?: string;
}

function Md({
  text,
  onNavigateEntry,
  nav,
}: {
  text: string;
  onNavigateEntry?: (slug: string) => void;
  nav?: NavContext;
}) {
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();

  const anchor = ({ href, children }: { href?: string; children?: ReactNode }) => {
    const url = href ?? "";
    if (nav?.active && linkText(children).trim() === nav.active.trim()) return current(children);
    // Another entry in the catalogue — the three in-app link forms are
    // classified in one place (lib/entry.ts), never re-parsed here.
    const entrySlug = onNavigateEntry ? entryTargetSlug(url) : null;
    if (entrySlug && onNavigateEntry) {
      return (
        <a
          href={`#/${entrySlug}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigateEntry(entrySlug);
          }}
        >
          {children}
        </a>
      );
    }
    // A jump inside this article (`[…](#name)`, spec 19). Deliberately not an
    // anchor element: the hash is the router, so following `#name` would leave
    // the entry and close the codex. A button moves the reading position and
    // cannot touch the URL — and it works the same inside a ::: nav bar.
    const jump = anchorLinkTarget(url);
    if (jump) {
      return (
        <button type="button" className="bio-jump" onClick={(e) => jumpTo(jump, e.currentTarget)}>
          {children}
        </button>
      );
    }
    // Media widgets belong to prose, not to a navigation bar (spec 10).
    if (!nav) {
      const src = isExternalUrl(url) ? url : resolveResourcePath(url);
      const kind = audioKind(url);
      if (kind) return <InlineAudioPlayer src={src} label={linkText(children) || filename(url)} kind={kind} />;
      if (isAsciiTabUrl(url)) {
        const label = tabLabel(linkText(children), url);
        return (
          <a href={src} onClick={open(() => openTab({ src, label, download: filename(url) }))}>
            {children}
          </a>
        );
      }
      if (isImageUrl(url)) {
        const label = linkText(children) || filename(url);
        return (
          <a
            href={src}
            onClick={open(() => openImage({ src, alt: label, caption: label, download: filename(url) }))}
          >
            {children}
          </a>
        );
      }
    }
    if (isExternalUrl(url)) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    // Legacy relative link (e.g. barrios1.htm) — archival reference.
    return (
      <a href={resolveResourcePath(url)} title={t("bio.archiveLink")} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  };

  // Only the link renderer needs this island's context; the rest are stable
  // module-level components, so they are never remounted on a re-render.
  const components = nav
    ? { a: anchor, li: NavItem }
    : { a: anchor, table: ScrollableTable, img: InlineImage };

  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {text}
    </ReactMarkdown>
  );
}

/** Move the reading position to a named anchor, resolved inside the article the
 *  click came from. A name nothing declares stays inert rather than scrolling
 *  somewhere arbitrary — the author hears about it instead. */
function jumpTo(name: string, from: Element): void {
  if (!scrollToAnchor(name, from) && import.meta.env.DEV) {
    console.warn(`[BioMD] this article declares no ::: anchor named "${name}".`);
  }
}

/** The current item of a nav bar: present, marked, not clickable. */
function current(children: ReactNode) {
  return (
    <span className="bio-nav-current" aria-current="page">
      {children}
    </span>
  );
}

/** A nav item written as plain text rather than a link is the current page (spec 10). */
function NavItem({ node, children }: { node?: unknown; children?: ReactNode }) {
  return <li>{hasAnchor(node) ? children : current(children)}</li>;
}

/** A wide table scrolls inside its own box, never the page (spec 3.8). */
function ScrollableTable({ children }: { children?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  );
}

/** An ordinary Markdown image: framed like a figure, click opens the viewer. */
function InlineImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  const openImage = useImageViewer();
  const url = typeof src === "string" ? resolveResourcePath(src) : undefined;
  return (
    <span
      className="bio-figure my-3 block cursor-zoom-in"
      onClick={() => url && openImage({ src: url, alt: alt ?? "", caption: alt, download: filename(url) })}
    >
      <CurlFrame>
        <img src={url} alt={alt ?? ""} loading="lazy" decoding="async" />
      </CurlFrame>
    </span>
  );
}

/** Suppress the browser navigation of a link that opens an in-app viewer. */
function open(action: () => void) {
  return (e: { preventDefault(): void }) => {
    e.preventDefault();
    action();
  };
}

/** Does this hast subtree contain a link? Unknown shapes count as "yes". */
function hasAnchor(node: unknown): boolean {
  if (!node || typeof node !== "object") return true;
  const el = node as { tagName?: string; children?: unknown[] };
  if (el.tagName === "a") return true;
  return Array.isArray(el.children) && el.children.some(hasAnchor);
}

/** Flatten a react-markdown link's children to plain text for a11y labels. */
function linkText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(linkText).join("");
  return "";
}

function filename(url: string): string {
  return url.split(/[?#]/, 1)[0].split("/").pop() || "audio";
}

/** A generic "TAB" label says nothing once the viewer is open — use the file. */
function tabLabel(text: string, url: string): string {
  const label = text.trim();
  return !label || /^(?:ascii\s*)?tab(?:lature)?$/i.test(label) ? filename(url) : label;
}

const SIZE_CLASS: Record<ImageNode["size"], string> = {
  small: "sm:max-w-[200px]",
  medium: "sm:max-w-[320px]",
  large: "sm:max-w-[460px]",
  full: "",
};

// A centered/full figure is a standalone block: per spec 6.2 it ends an earlier
// left/right image wrap instead of sliding into the gap beside it. (`clear` has
// no effect on the grid items of an ::: images group — harmless there.)
const FLOAT_CLASS: Record<ImageNode["position"], string> = {
  left: "sm:float-left sm:mr-6 sm:mb-2",
  right: "sm:float-right sm:ml-6 sm:mb-2",
  center: "mx-auto clear-both",
  full: "mx-auto clear-both",
};

/** Literal classes, not built from `tracks` — Tailwind only emits what it sees. */
const IMAGES_TRACK_CLASS: Record<Tracks, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const ALIGN_CLASS: Record<ContentAlignment, string> = {
  left: "bio-align-left",
  center: "bio-align-center",
  right: "bio-align-right",
};

const FRAME_TONE_CLASS: Record<FrameTone, string> = {
  gold: "bio-frame--gold",
  black: "bio-frame--black",
  red: "bio-frame--red",
  white: "bio-frame--white",
};

/**
 * Where a figure click leads (spec 6.4). Without `link` — and for a `link` that
 * points at an image — the image viewer opens; a *.bio.md link turns the page
 * inside the codex; a `#name` link jumps within the article (spec 19); any
 * other target is an ordinary anchor around the picture.
 */
type FigureTarget =
  | { as: "viewer"; src: string }
  | { as: "entry"; md: string }
  | { as: "jump"; anchor: string }
  | { as: "href"; href: string };

function figureTarget(node: ImageNode, canNavigate: boolean): FigureTarget {
  const link = node.link;
  const resolve = (p: string) => (isExternalUrl(p) ? p : resolveResourcePath(p));
  if (!link || isImageUrl(link)) return { as: "viewer", src: resolve(link ?? node.src) };
  const anchor = anchorLinkTarget(link);
  if (anchor) return { as: "jump", anchor };
  if (/\.bio\.md$/i.test(link) && !isExternalUrl(link) && canNavigate) return { as: "entry", md: link };
  return { as: "href", href: resolve(link) };
}

function Figure({ node, onNavigateEntry }: { node: ImageNode; onNavigateEntry?: (p: string) => void }) {
  const openImage = useImageViewer();
  const src = resolveResourcePath(node.src);
  const alt = node.alt ?? node.caption ?? "";
  const target = figureTarget(node, Boolean(onNavigateEntry));

  const onClick: MouseEventHandler<HTMLElement> | undefined =
    target.as === "viewer"
      ? () => openImage({ src: target.src, alt, caption: node.caption, download: filename(target.src) })
      : target.as === "entry"
        ? () => onNavigateEntry?.(target.md)
        : target.as === "jump"
          ? (e) => jumpTo(target.anchor, e.currentTarget)
          : undefined;

  const picture = (
    <CurlFrame variant={node.frame}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.closest("figure")?.classList.add("bio-figure-broken");
        }}
      />
    </CurlFrame>
  );

  return (
    <figure
      // An anchor that introduces a picture inside an ::: images group names the
      // cell itself, because the grid has no room for a marker node (spec 19).
      id={node.anchor && anchorElementId(node.anchor)}
      className={clsx(
        "bio-figure my-4 w-full",
        SIZE_CLASS[node.size],
        FLOAT_CLASS[node.position],
        node.anchor && "bio-anchor-target",
        target.as === "viewer"
          ? "cursor-zoom-in"
          : (target.as === "entry" || target.as === "jump") && "cursor-pointer",
      )}
      onClick={onClick}
    >
      {target.as === "href" ? (
        <a className="bio-figure-link" href={target.href} target="_blank" rel="noopener noreferrer">
          {picture}
        </a>
      ) : (
        picture
      )}
      {node.caption && <figcaption>{node.caption}</figcaption>}
    </figure>
  );
}

/**
 * In-article horizontal menu (`::: nav`). The link list is rendered by the
 * ordinary Markdown pipeline, so every item keeps the article's link rewiring
 * (bio.md → in-app navigation, external → new tab); `.bio-nav` CSS turns the
 * <ul> into the same pill bar as the codex tab strip. These are real links, so
 * no tab/tablist roles — they navigate rather than switch a panel in place.
 */
function BioNav({ node, onNavigateEntry }: { node: NavNode; onNavigateEntry?: (p: string) => void }) {
  const nav = useMemo<NavContext>(() => ({ active: node.active }), [node.active]);
  return (
    <nav className="bio-nav">
      {node.title && <div className="bio-nav-title">{node.title}</div>}
      <Md text={node.markdown} onNavigateEntry={onNavigateEntry} nav={nav} />
    </nav>
  );
}

function renderNode(node: BioNode, key: number, onNavigateEntry?: (p: string) => void): ReactNode {
  const kids = (children: BioNode[]) => children.map((c, i) => renderNode(c, i, onNavigateEntry));

  switch (node.kind) {
    case "markdown":
      return <Md key={key} text={node.text} onNavigateEntry={onNavigateEntry} />;

    case "lead":
      return (
        <div key={key} className="bio-lead drop-cap my-4">
          {kids(node.children)}
        </div>
      );

    case "align":
      return (
        <div key={key} className={clsx("bio-align", node.position && ALIGN_CLASS[node.position])}>
          {kids(node.children)}
        </div>
      );

    case "image":
      return <Figure key={key} node={node} onNavigateEntry={onNavigateEntry} />;

    case "images":
      return (
        <div
          key={key}
          className={clsx("my-5 grid grid-cols-1 gap-4 clear-both", IMAGES_TRACK_CLASS[node.tracks])}
        >
          {node.images.map((img, i) => (
            <Figure
              key={i}
              node={{ ...img, position: "center", size: "full" }}
              onNavigateEntry={onNavigateEntry}
            />
          ))}
        </div>
      );

    case "document":
      return <DocumentCard key={key} node={node} />;

    case "nav":
      return <BioNav key={key} node={node} onNavigateEntry={onNavigateEntry} />;

    case "columns":
      // One grid, `tracks` columns wide: cells beyond the first row wrap into
      // the next one, so a whole record grid fits in a single block (spec 9.1).
      return (
        <div
          key={key}
          className={clsx(
            "bio-columns",
            `bio-cols-${node.tracks}`,
            node.divider && "bio-columns--divided",
          )}
        >
          {node.cells.map((cell, i) => (
            <div key={i}>{kids(cell)}</div>
          ))}
        </div>
      );

    case "frame":
      return (
        <div key={key} className={clsx("bio-frame", FRAME_TONE_CLASS[node.tone])}>
          {node.title && <p className="bio-frame-title">{node.title}</p>}
          {kids(node.children)}
        </div>
      );

    case "signature":
      return (
        <footer key={key} className="bio-signature">
          {kids(node.children)}
        </footer>
      );

    case "anchor":
      // A named place, not content: no box of its own, and offset so the codex
      // controls never cover the line it introduces (see .bio-anchor).
      return <span key={key} id={anchorElementId(node.name)} className="bio-anchor" aria-hidden />;

    case "unknown":
      // Spec: unknown block → render inner content, never delete it.
      return (
        <div key={key} className="my-3">
          {kids(node.children)}
        </div>
      );
  }
}

/** A PDF is the only target worth embedding in place (spec 8). */
const EMBEDDABLE = /\.pdf$/i;

function DocumentCard({ node }: { node: DocumentNode }) {
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();
  const { src, title } = node;
  const href = resolveResourcePath(src);
  const label = title ?? src.split("/").pop() ?? src;
  const cardClass =
    "bio-doc flex w-full items-center gap-3 border border-gold-600/50 bg-paper-100/70 px-4 py-3 text-left no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]";
  const content = (
    <>
      <span aria-hidden className="text-2xl text-gold-700">
        ❧
      </span>
      <span>
        <span className="block font-heading text-sm tracking-wide text-burgundy-700">{label}</span>
        <span className="block text-xs italic text-sepia-600">{t("bio.attachedDocument")}</span>
      </span>
    </>
  );

  // An in-app viewer already exists for images and tablature: open it in place
  // of a download, whatever `mode` says.
  const viewer = isImageUrl(src)
    ? () => openImage({ src: href, alt: label, caption: label })
    : isAsciiTabUrl(src)
      ? () => openTab({ src: href, label, download: filename(src) })
      : null;

  const card = viewer ? (
    <button type="button" className={cardClass} onClick={viewer}>
      {content}
    </button>
  ) : (
    <a className={cardClass} href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );

  // `mode: embed` embeds where the browser supports it and keeps the card as
  // the accessible fallback (spec 8). Lazy: it loads when scrolled into view.
  if (node.mode === "embed" && EMBEDDABLE.test(filename(src))) {
    return (
      <figure className="bio-doc-embed">
        <iframe src={href} title={label} loading="lazy" />
        {card}
      </figure>
    );
  }
  return <div className="my-4">{card}</div>;
}

export const BioArticle = memo(function BioArticle({ doc, onNavigateEntry, titles = [] }: ArticleProps) {
  if (import.meta.env.DEV && doc.warnings.length) {
    console.warn("[BioMD]", doc.warnings);
  }

  return (
    <article className="bio-article">
      {titles.length > 0 && (
        // A title the plate does not carry: printed the way the plate would
        // have, not as a section heading — the article is what it names.
        <header className="bio-titles">
          {titles.map((line, i) =>
            i === 0 ? (
              <h2 key={i} className="bio-title">
                {line}
              </h2>
            ) : (
              <h3 key={i} className="bio-title bio-title--second">
                {line}
              </h3>
            ),
          )}
        </header>
      )}
      {doc.nodes.map((n, i) => renderNode(n, i, onNavigateEntry))}
      <div className="clear-both" />
    </article>
  );
});
