import { m } from "framer-motion";
import { audio } from "@/lib/audio";
import { typeLabel, useI18n } from "@/lib/i18n";
import { countryName } from "@/lib/metadata";
import { toggleValue, type GenderFilter, type LangScope, type SearchCriteria } from "@/lib/search";
import { ChipGroup, Field, SegmentedControl, TextField, TokenSelect, YearRangeField } from "@/components/form";
import { Divider } from "@/components/OrnateFrame";
import { DossierProgress, type DossierStatus } from "./DossierProgress";

/**
 * The refinement panel: everything the reader can narrow by, laid out on one
 * parchment leaf.
 *
 * It is a **controlled, stateless view** of one `SearchCriteria` value — every
 * control reports a patch and holds nothing of its own. That is what keeps the
 * panel, the quick facet chips under the bar and the URL-less "N refinements"
 * badge from ever disagreeing, and what makes a new criterion three small
 * edits (the interface, `compile`, one `<Field>`) instead of a new state
 * machine.
 *
 * Reading order goes from the coarsest sieve to the finest — where the records
 * come from, who they are, then the exact name and years — which is also the
 * order the engine applies them in.
 */
export function AdvancedSearchPanel({
  id,
  criteria,
  onPatch,
  onReset,
  onClose,
  types,
  countries,
  dossier,
}: {
  id: string;
  criteria: SearchCriteria;
  onPatch: (patch: Partial<SearchCriteria>) => void;
  onReset: () => void;
  onClose: () => void;
  readonly types: readonly string[];
  /** ISO 3166-1 alpha-2 codes present in the catalogue. */
  readonly countries: readonly string[];
  dossier: DossierStatus;
}) {
  const { t, locale } = useI18n();
  const labelId = (name: string) => `${id}-${name}`;

  return (
    <m.div
      id={id}
      role="group"
      aria-label={t("search.advanced.title")}
      initial={{ opacity: 0, y: -10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.16 } }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="search-panel origin-top"
    >
      <p className="search-panel-title">
        <span aria-hidden>✦</span>
        {t("search.advanced.title")}
        <span aria-hidden>✦</span>
      </p>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field id={labelId("scope")} label={t("search.scope")}>
          <SegmentedControl<LangScope>
            value={criteria.scope}
            onChange={(scope) => onPatch({ scope })}
            labelledBy={labelId("scope")}
            segments={[
              { value: "all", label: t("search.scope.all") },
              { value: "current", label: t("search.scope.current") },
            ]}
          />
        </Field>

        <Field id={labelId("gender")} label={t("search.gender")}>
          <SegmentedControl<GenderFilter>
            value={criteria.gender}
            onChange={(gender) => onPatch({ gender })}
            labelledBy={labelId("gender")}
            segments={[
              { value: "any", label: t("search.gender.any") },
              { value: "m", label: t("lore.gender.m") },
              { value: "f", label: t("lore.gender.f") },
            ]}
          />
        </Field>

        <Field id={labelId("type")} label={t("facet.type")} className="sm:col-span-2">
          <ChipGroup
            values={types}
            selected={criteria.types}
            onToggle={(value) => onPatch({ types: toggleValue(criteria.types, value) })}
            label={(value) => typeLabel(t, value)}
            labelledBy={labelId("type")}
            size="sm"
          />
        </Field>

        <Field id={labelId("country")} label={t("facet.country")} className="sm:col-span-2">
          <TokenSelect
            selected={criteria.countries}
            values={countries}
            onToggle={(value) => onPatch({ countries: toggleValue(criteria.countries, value) })}
            label={(value) => countryName(value, locale) ?? value}
            labelledBy={labelId("country")}
            placeholder={t("search.country.any")}
          />
        </Field>

        <Field id={labelId("forename")} label={t("search.forename")}>
          <TextField
            value={criteria.forename}
            onChange={(forename) => onPatch({ forename })}
            labelledBy={labelId("forename")}
          />
        </Field>

        <Field id={labelId("surname")} label={t("search.surname")}>
          <TextField
            value={criteria.surname}
            onChange={(surname) => onPatch({ surname })}
            labelledBy={labelId("surname")}
          />
        </Field>

        <Field id={labelId("born")} label={t("search.born")}>
          <YearRangeField
            value={criteria.born}
            onChange={(born) => onPatch({ born })}
            labelledBy={labelId("born")}
            fromLabel={t("search.yearFrom")}
            toLabel={t("search.yearTo")}
          />
        </Field>

        <Field id={labelId("died")} label={t("search.died")}>
          <YearRangeField
            value={criteria.died}
            onChange={(died) => onPatch({ died })}
            labelledBy={labelId("died")}
            fromLabel={t("search.yearFrom")}
            toLabel={t("search.yearTo")}
          />
        </Field>
      </div>

      <Divider className="mx-auto my-3 w-full max-w-xs opacity-70" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-4 flex-col gap-1">
          <span className="font-body text-[0.72rem] italic leading-snug text-sepia-500">
            {t("search.dossier.hint")}
          </span>
          <DossierProgress status={dossier} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              audio.click();
              onReset();
            }}
            onMouseEnter={() => audio.hover()}
            className="font-heading text-[0.66rem] uppercase tracking-[0.16em] text-sepia-600 underline decoration-dotted decoration-1 underline-offset-4 transition-colors hover:text-burgundy-600"
          >
            {t("search.advanced.reset")}
          </button>
          <button type="button" onClick={onClose} className="btn-rpg !px-3 !py-[0.32rem]">
            {t("search.advanced.hide")}
          </button>
        </div>
      </div>
    </m.div>
  );
}
