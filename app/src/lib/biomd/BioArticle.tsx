import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { remarkHighlight } from "./remarkHighlight";
import { parseBioMd, type BioNode, type ImageNode } from "./parse";
import { isExternalUrl, resolveResourcePath } from "../paths";
import { audioKind } from "../playback";
import { isImageUrl, useImageViewer } from "../imageViewer";
import { isAsciiTabUrl } from "../asciiTab";
import { useAsciiTabViewer } from "../asciiTabViewer";
import { useI18n } from "../i18n";
import { InlineAudioPlayer } from "@/components/AudioPlayer";
import { CurlFrame } from "@/components/CurlFrame";

/**
 * BioMD Lite → React renderer.
 * Plain-markdown runs go through react-markdown (GFM tables, quotes) plus
 * the ==highlight== plugin; layout blocks render as dedicated components.
 * Everything stays readable in source order (mobile stacks floats).
 */

interface ArticleProps {
  source: string;
  /** Called when a link to another catalogue entry (*.bio.md) is clicked. */
  onNavigateEntry?: (mdPath: string) => void;
  /** Hide the article's own `# title` (the codex header already shows it). */
  hideTitle?: boolean;
}

const REMARK_PLUGINS = [remarkGfm, remarkHighlight];

function Md({ text, onNavigateEntry }: { text: string; onNavigateEntry?: (p: string) => void }) {
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      components={{
        a: ({ href, children }) => {
          const url = href ?? "";
          if (/\.bio\.md$/i.test(url) && !isExternalUrl(url) && onNavigateEntry) {
            return (
              <a
                href={`#/${url.split("/").pop()?.replace(/\.bio\.md$/i, "")}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateEntry(url);
                }}
              >
                {children}
              </a>
            );
          }
          const kind = audioKind(url);
          if (kind) {
            const src = isExternalUrl(url) ? url : resolveResourcePath(url);
            return <InlineAudioPlayer src={src} label={linkText(children) || filename(url)} kind={kind} />;
          }
          if (isAsciiTabUrl(url)) {
            const src = isExternalUrl(url) ? url : resolveResourcePath(url);
            const text = linkText(children).trim();
            const label = !text || /^(?:ascii\s*)?tab(?:lature)?$/i.test(text) ? filename(url) : text;
            return (
              <a
                href={src}
                onClick={(e) => {
                  e.preventDefault();
                  openTab({ src, label, download: filename(url) });
                }}
              >
                {children}
              </a>
            );
          }
          if (isImageUrl(url)) {
            const src = isExternalUrl(url) ? url : resolveResourcePath(url);
            const label = linkText(children) || filename(url);
            return (
              <a
                href={src}
                onClick={(e) => {
                  e.preventDefault();
                  openImage({ src, alt: label, caption: label, download: filename(url) });
                }}
              >
                {children}
              </a>
            );
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
            <a
              href={resolveResourcePath(url)}
              title={t("bio.archiveLink")}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        table: (props) => (
          <div className="overflow-x-auto">
            <table>{props.children}</table>
          </div>
        ),
        img: ({ src, alt }) => {
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
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
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

const SIZE_CLASS: Record<ImageNode["size"], string> = {
  small: "sm:max-w-[200px]",
  medium: "sm:max-w-[320px]",
  large: "sm:max-w-[460px]",
  full: "",
};

function Figure({ node }: { node: ImageNode }) {
  const openImage = useImageViewer();
  const src = resolveResourcePath(node.src);
  const float =
    node.position === "left"
      ? "sm:float-left sm:mr-6 sm:mb-2"
      : node.position === "right"
        ? "sm:float-right sm:ml-6 sm:mb-2"
        : "mx-auto";
  return (
    <figure
      className={clsx("bio-figure my-4 w-full cursor-zoom-in", SIZE_CLASS[node.size], float)}
      onClick={() => openImage({ src, alt: node.caption ?? "", caption: node.caption, download: filename(node.src) })}
    >
      <CurlFrame>
        <img
          src={src}
          alt={node.caption ?? ""}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.closest("figure")?.classList.add("bio-figure-broken");
          }}
        />
      </CurlFrame>
      {node.caption && <figcaption>{node.caption}</figcaption>}
    </figure>
  );
}

function renderNode(
  node: BioNode,
  key: number,
  onNavigateEntry?: (p: string) => void,
): ReactNode {
  switch (node.kind) {
    case "markdown":
      return <Md key={key} text={node.text} onNavigateEntry={onNavigateEntry} />;

    case "lead":
      return (
        <div key={key} className="bio-lead drop-cap my-4">
          {node.children.map((c, i) => renderNode(c, i, onNavigateEntry))}
        </div>
      );

    case "image":
      return <Figure key={key} node={node} />;

    case "images": {
      const colClass =
        node.columns === 4
          ? "sm:grid-cols-4"
          : node.columns === 3
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2";
      return (
        <div key={key} className={clsx("my-5 grid grid-cols-1 gap-4", colClass)}>
          {node.images.map((img, i) => (
            <Figure key={i} node={{ ...img, position: "center", size: "full" }} />
          ))}
        </div>
      );
    }

    case "document":
      return <DocumentCard key={key} src={node.src} title={node.title} />;

    case "columns": {
      const grid =
        node.columns.length >= 3 ? "md:grid-cols-3" : node.columns.length === 2 ? "md:grid-cols-2" : "";
      return (
        <div key={key} className={clsx("my-4 grid grid-cols-1 items-start gap-x-8 gap-y-2", grid)}>
          {node.columns.map((col, i) => (
            <div key={i} className="min-w-0">
              {col.map((c, j) => renderNode(c, j, onNavigateEntry))}
            </div>
          ))}
        </div>
      );
    }

    case "unknown":
      // Spec: unknown block → render inner content, never delete it.
      return (
        <div key={key} className="my-3">
          {node.children.map((c, i) => renderNode(c, i, onNavigateEntry))}
        </div>
      );
  }
}

function DocumentCard({ src, title }: { src: string; title?: string }) {
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();
  const href = resolveResourcePath(src);
  const label = title ?? src.split("/").pop() ?? src;
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

  if (isImageUrl(src)) {
    return (
      <button
        type="button"
        className="my-4 flex w-full items-center gap-3 border border-gold-600/50 bg-paper-100/70 px-4 py-3 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]"
        onClick={() => openImage({ src: href, alt: label, caption: label })}
      >
        {content}
      </button>
    );
  }

  if (isAsciiTabUrl(src)) {
    return (
      <button
        type="button"
        className="my-4 flex w-full items-center gap-3 border border-gold-600/50 bg-paper-100/70 px-4 py-3 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]"
        onClick={() => openTab({ src: href, label, download: filename(src) })}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      className="my-4 flex items-center gap-3 border border-gold-600/50 bg-paper-100/70 px-4 py-3 no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
    </a>
  );
}

export const BioArticle = memo(function BioArticle({
  source,
  onNavigateEntry,
  hideTitle = true,
}: ArticleProps) {
  const doc = useMemo(() => parseBioMd(source), [source]);

  if (import.meta.env.DEV && doc.warnings.length) {
    console.warn("[BioMD]", doc.warnings);
  }

  return (
    <article className="bio-article">
      {!hideTitle && doc.title && (
        <h1 className="font-display text-center text-3xl uppercase tracking-[0.14em] text-burgundy-600">
          {doc.title}
        </h1>
      )}
      {doc.nodes.map((n, i) => renderNode(n, i, onNavigateEntry))}
      <div className="clear-both" />
    </article>
  );
});
