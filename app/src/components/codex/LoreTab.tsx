import type { ReactNode } from "react";
import type { EntryBundle, IndexEntry } from "@/lib/types";
import {
  ageOf,
  countryDisplay,
  formatDmy,
  rankStars,
  regionName,
  splitList,
} from "@/lib/metadata";
import { typeLabel, useI18n, type TFunc } from "@/lib/i18n";
import { RankStars } from "../OrnateFrame";

/**
 * Lore / Attributes — a scholarly dossier generated *dynamically* from
 * whatever metadata is present (docs/MetaData.md: never rely on a fixed
 * field set; absent value → absent row, not an empty label). Technical
 * fields (id, bio, url, dataStatus) are deliberately not shown.
 */
export function LoreTab({ entry, bundle }: { entry: IndexEntry; bundle: EntryBundle }) {
  const { t, locale } = useI18n();
  const meta = bundle.data?.metadata;

  if (!meta) {
    return <p className="text-center font-body italic text-sepia-600">{t("lore.noData")}</p>;
  }

  const dates = meta.dates ?? {};
  const age = ageOf(dates.born, dates.died);
  const stars = rankStars(meta.ranking);
  const country =
    (meta.country ? regionName(meta.country, locale) : null) ?? countryDisplay(entry.country, locale);
  const genderKey = meta.gender === "m" || meta.gender === "f" ? (`lore.gender.${meta.gender}` as const) : null;
  const active =
    dates.activeFrom || dates.activeTo
      ? `${formatDmy(dates.activeFrom, locale) ?? "…"} — ${formatDmy(dates.activeTo, locale) ?? "…"}`
      : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
      <Section title={t("lore.identity")}>
        <Row label={t("lore.birthname")}>{meta.birthname}</Row>
        <Row label={t("lore.gender")}>{genderKey ? t(genderKey) : meta.gender}</Row>
        <Row label={t("lore.type")}>{typeLabel(t, meta.type ?? entry.type)}</Row>
        <Row label={t("lore.country")}>{country}</Row>
        <Row label={t("lore.born")}>
          {joinParts(formatDmy(dates.born, locale), meta.birthplace)}
        </Row>
        <Row label={t("lore.died")}>
          {joinParts(formatDmy(dates.died, locale), meta.deathplace)}
        </Row>
        <Row label={t("lore.age")}>{age !== null ? t("lore.years", { n: age }) : null}</Row>
        <Row label={t("lore.activeYears")}>{active}</Row>
      </Section>

      <Section title={t("lore.career")}>
        <Row label={t("lore.instruments")}>{chips(splitList(meta.instruments))}</Row>
        <Row label={t("lore.genres")}>{chips(splitList(meta.genres))}</Row>
        <Row label={t("lore.jobs")}>{chips(splitList(meta.jobs).map((j) => localizeJob(t, j)))}</Row>
        <Row label={t("lore.bands")}>{chips(splitList(meta.bands))}</Row>
        <Row label={t("lore.awards")}>{listText(splitList(meta.awards))}</Row>
        <Row label={t("lore.ranking")}>
          {stars !== null && (
            <span className="inline-flex items-center gap-2">
              <RankStars count={stars} accent="#8a6a1f" />
              <RankingBar value={meta.ranking as number} />
            </span>
          )}
        </Row>
      </Section>

      <div className="sm:col-span-2">
        <Section title={t("lore.relations")}>
          <Row label={t("lore.teachers")}>{listText(splitList(meta.teachers))}</Row>
          <Row label={t("lore.disciples")}>{listText(splitList(meta.disciples))}</Row>
          <Row label={t("lore.relatives")}>{listText(splitList(meta.relatives))}</Row>
        </Section>
      </div>
    </div>
  );
}

/* ---------- building blocks ---------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-gold-600/45 bg-paper-100/60 p-4">
      <h3 className="mb-3 border-b border-gold-600/40 pb-2 text-center font-heading text-xs uppercase tracking-[0.3em] text-burgundy-700">
        {title}
      </h3>
      <dl className="m-0">{children}</dl>
    </section>
  );
}

/** Absent value → absent row (never an empty label). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  if (
    children === null ||
    children === undefined ||
    children === "" ||
    (Array.isArray(children) && children.length === 0)
  ) {
    return null;
  }
  return (
    <div className="flex items-baseline gap-3 border-b border-sepia-500/20 py-1.5 last:border-b-0">
      <dt className="w-32 shrink-0 font-heading text-[0.7rem] uppercase tracking-wider text-sepia-600">{label}</dt>
      <dd className="m-0 min-w-0 font-body text-[0.98rem] text-ink-800">{children}</dd>
    </div>
  );
}

function joinParts(...parts: Array<string | null | undefined>): string | null {
  const joined = parts.filter(Boolean).join(" · ");
  return joined || null;
}

function chips(items: string[]): ReactNode {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className="rounded-sm border border-gold-600/50 bg-paper-200/70 px-1.5 py-0.5 text-[0.8rem] leading-tight">
          {x}
        </span>
      ))}
    </span>
  );
}

function listText(items: string[]): string | null {
  return items.length ? items.join(", ") : null;
}

/** Jobs arrive as English words in the data; reuse type labels where known. */
function localizeJob(t: TFunc, job: string): string {
  const lower = job.toLowerCase();
  const label = typeLabel(t, lower);
  return label === lower ? job : label;
}

function RankingBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span
      className="relative inline-block h-2.5 w-24 overflow-hidden rounded-sm border border-gold-700/60 bg-paper-300 align-middle"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-burgundy-600 via-gold-600 to-gold-400"
        style={{ width: `${clamped}%` }}
      />
    </span>
  );
}
