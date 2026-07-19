import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { remarkHighlight } from "./remarkHighlight";
import { parseBioMd, type BioNode, type ImageNode } from "./parse";
import { isExternalUrl, resolveContentPath } from "../paths";
import { useI18n } from "../i18n";

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
              href={resolveContentPath(url)}
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
        img: ({ src, alt }) => (
          <span className="bio-figure my-3 block">
            <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" />
          </span>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

const SIZE_CLASS: Record<ImageNode["size"], string> = {
  small: "sm:max-w-[200px]",
  medium: "sm:max-w-[320px]",
  large: "sm:max-w-[460px]",
  full: "",
};

function Figure({ node }: { node: ImageNode }) {
  const float =
    node.position === "left"
      ? "sm:float-left sm:mr-6 sm:mb-2"
      : node.position === "right"
        ? "sm:float-right sm:ml-6 sm:mb-2"
        : "mx-auto";
  return (
    <figure className={clsx("bio-figure my-4 w-full", SIZE_CLASS[node.size], float)}>
      <img
        src={resolveContentPath(node.src)}
        alt={node.caption ?? ""}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.closest("figure")?.classList.add("bio-figure-broken");
        }}
      />
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
  return (
    <a
      className="my-4 flex items-center gap-3 border border-gold-600/50 bg-paper-100/70 px-4 py-3 no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.25)]"
      href={isExternalUrl(src) ? src : resolveContentPath(src)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span aria-hidden className="text-2xl text-gold-700">
        ❧
      </span>
      <span>
        <span className="block font-heading text-sm tracking-wide text-burgundy-700">
          {title ?? src.split("/").pop()}
        </span>
        <span className="block text-xs italic text-sepia-600">{t("bio.attachedDocument")}</span>
      </span>
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
