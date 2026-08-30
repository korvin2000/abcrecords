import { useEffect, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

/**
 * The document viewer's control bar: paging, zoom, fit, rotation and
 * download, in the catalogue's own gold-on-parchment language rather than the
 * browser's grey PDF chrome.
 *
 * It is presentational — every control reports upward and nothing here knows
 * what pdf.js is. The page field is the one piece with state of its own: it
 * follows the scroll position while the reader is not typing in it, and
 * commits on Enter or blur.
 */

export type FitMode = "width" | "page" | null;

interface Props {
  /** Shown left of the controls; the entry's name, not the file name. */
  title?: string;
  page: number;
  pageCount: number;
  /** CSS pixels per PDF point, for the percentage readout. */
  scale: number;
  fit: FitMode;
  onGoToPage: (page: number) => void;
  onZoom: (direction: -1 | 1) => void;
  onFit: (mode: Exclude<FitMode, null>) => void;
  onRotate: () => void;
  /** Resolved URL of the file, used by the download control. */
  href: string;
  download?: string;
  onClose?: () => void;
}

export function PdfToolbar({
  title,
  page,
  pageCount,
  scale,
  fit,
  onGoToPage,
  onZoom,
  onFit,
  onRotate,
  href,
  download,
  onClose,
}: Props) {
  const { t } = useI18n();

  return (
    /*
     * One flat wrapping row rather than a left/right split, because the split
     * is what a phone cannot honour: at 375 px the controls need two lines,
     * and a `justify-between` layout answers that by stranding the close
     * button alone on a line of its own. Flat, everything packs.
     *
     * The `mr-auto` pair is what restores the split once there is room: below
     * `lg` the title is hidden, so the close button carries it and the
     * controls sit right; from `lg` the title takes it over and the two of
     * them sit left together.
     */
    <div className="relative z-20 flex flex-wrap items-center justify-center gap-1 border-b border-gold-600/35 bg-paper-100/60 px-3 py-1.5 sm:px-4 sm:py-2">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="btn-rpg !px-3 sm:mr-auto lg:mr-0"
          aria-label={t("viewer.close")}
          title={t("viewer.close")}
        >
          <span className="hidden sm:inline">{t("viewer.close")}</span>
          <span className="sm:hidden" aria-hidden>
            ✕
          </span>
        </button>
      )}
      {title && (
        <span className="hidden min-w-0 max-w-[22ch] truncate font-heading text-sm tracking-wide text-burgundy-700 lg:mr-auto lg:block">
          {title}
        </span>
      )}

      <Group>
        <IconButton onClick={() => onGoToPage(page - 1)} disabled={page <= 1} label={t("pdf.prevPage")}>
          <Icon d="M15 19l-7-7 7-7" />
        </IconButton>
        <PageField page={page} pageCount={pageCount} onGoToPage={onGoToPage} />
        <IconButton onClick={() => onGoToPage(page + 1)} disabled={page >= pageCount} label={t("pdf.nextPage")}>
          <Icon d="M9 5l7 7-7 7" />
        </IconButton>
      </Group>

      <Group>
        <IconButton onClick={() => onZoom(-1)} label={t("viewer.zoomOut")}>
          <Icon d="M5 12h14" />
        </IconButton>
        <span className="w-11 text-center font-heading text-xs tabular-nums text-ink-800">
          {Math.round(scale * 100)}%
        </span>
        <IconButton onClick={() => onZoom(1)} label={t("viewer.zoomIn")}>
          <Icon d="M12 5v14M5 12h14" />
        </IconButton>
      </Group>

      <Group>
        <IconButton onClick={() => onFit("width")} active={fit === "width"} label={t("pdf.fitWidth")}>
          <Icon d="M3 5v14M21 5v14M7 12h10m0 0-3-3m3 3-3 3M7 12l3-3m-3 3 3 3" />
        </IconButton>
        <IconButton onClick={() => onFit("page")} active={fit === "page"} label={t("pdf.fitPage")}>
          <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </IconButton>
        <IconButton onClick={onRotate} label={t("viewer.rotateRight")}>
          <Icon d="M21 12a9 9 0 1 1-3-6.7M21 3v4h-4" />
        </IconButton>
        <a
          href={href}
          download={download ?? ""}
          className={clsx(BUTTON, "text-gold-800")}
          title={t("viewer.download")}
          aria-label={t("viewer.download")}
        >
          <Icon d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
        </a>
      </Group>
    </div>
  );
}

/**
 * Follows the reader's position, except while they are editing it — a field
 * that rewrites itself under the caret cannot be typed into.
 */
function PageField({
  page,
  pageCount,
  onGoToPage,
}: {
  page: number;
  pageCount: number;
  onGoToPage: (page: number) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [page]);

  const commit = (raw: string) => {
    const wanted = Number.parseInt(raw, 10);
    setDraft(null);
    if (Number.isFinite(wanted)) onGoToPage(wanted);
  };

  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={draft ?? String(page)}
        aria-label={t("pdf.page")}
        title={t("pdf.page")}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => draft !== null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") setDraft(null);
          e.stopPropagation(); // the viewer's own shortcuts must not fire here
        }}
        className="h-8 w-10 rounded-sm border border-gold-600/50 bg-paper-50 text-center font-heading text-xs tabular-nums text-ink-800 outline-none focus:border-gold-600"
      />
      <span className="font-heading text-xs tabular-nums text-sepia-600">
        {t("pdf.pageOf", { total: pageCount })}
      </span>
    </span>
  );
}

const BUTTON =
  "grid h-8 w-8 place-items-center rounded-full border border-gold-600/40 text-gold-800 transition-colors hover:border-gold-600/80 hover:bg-gold-500/20 disabled:cursor-default disabled:opacity-35 disabled:hover:border-gold-600/40 disabled:hover:bg-transparent";

function IconButton({
  onClick,
  label,
  active,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={clsx(BUTTON, active && "border-gold-600/80 bg-gold-500/25")}
    >
      {children}
    </button>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-gold-600/30 bg-paper-50/70 px-1 py-0.5">
      {children}
    </span>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
