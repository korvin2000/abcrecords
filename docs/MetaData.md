# MetaData.json Guide

## Purpose

`MetaData.json` stores structured information associated with one biography entry.  
It is intended to supply the **Lore / Attributes**, **Gallery**, and **Documents** tabs, while the main biography text remains in a separate Markdown file referenced by `metadata.bio`.

This guide describes the structure inferred from the current JSON example. Fields marked as optional are inferred rather than formally enforced by a JSON Schema.

---

## Top-level structure

```json
{
  "metadata": {},
  "media": {
    "photos": [],
    "music": []
  },
  "documents": []
}
```

| Section | Purpose |
|---|---|
| `metadata` | Identity, dates, classification, relationships, career data, biography file, and external URL |
| `media.photos` | Images displayed in the Gallery tab |
| `media.music` | Audio files or music links |
| `documents` | Documents, transcripts, dossiers, scans, or embedded records |

---

## LLM authoring rules

When creating or modifying `MetaData.json`:

1. Output valid UTF-8 JSON only.
2. Use double quotes around keys and string values.
3. Do not add comments or trailing commas.
4. Preserve the three top-level sections: `metadata`, `media`, and `documents`.
5. Do not invent unknown biographical facts. Omit an optional field or use `null` when the application supports it.
6. Keep `metadata.id` unique and stable.
7. Use `DD.MM.YYYY` for dates unless the project later standardizes another format.
8. Use ISO 3166-1 alpha-2 country codes, for example `RU`, `DE`, `ES`, or `BR`.
9. Store file references as relative project paths whenever possible.
10. Preserve Unicode names and titles without transliteration unless a separate transliterated field is introduced.
11. Treat comma-separated fields as lists encoded in a string. Do not split names containing commas unless the source format explicitly uses commas as separators.
12. Unknown fields should be preserved when editing an existing file.

---

## `metadata`

### Core identity fields

| Field | Type | Expected meaning |
|---|---:|---|
| `id` | string | Unique biography identifier. Leading zeroes are significant. |
| `title` | string | Primary display title of the biography entry. |
| `birthname` | string | Full birth name or complete legal name. |
| `gender` | string | Compact gender code, such as `m`, `f`, or another project-defined value. |
| `type` | string | Entry category, for example `guitarist`, `composer`, `conductor`, or `luthier`. |
| `surname` | string | Family name. |
| `forename` | string | Given name. |
| `country` | string | ISO two-letter country code. |
| `birthplace` | string | Place of birth. |
| `deathplace` | string | Place of death. |

### Dates

```json
"dates": {
  "born": "11.02.1920",
  "died": "11.02.1990",
  "activeFrom": "11.02.1940",
  "activeTo": "11.02.1980"
}
```

| Field | Type | Meaning |
|---|---:|---|
| `born` | string | Date of birth |
| `died` | string | Date of death |
| `activeFrom` | string | Beginning of the documented active period |
| `activeTo` | string | End of the documented active period |

Dates may be absent for living persons or when the source is unknown. A parser must not assume that every date exists.

### Relationships and career

| Field | Type | Expected meaning |
|---|---:|---|
| `relatives` | string | Related persons; currently represented as one value or a comma-separated list |
| `instruments` | string | Instrument names, potentially comma-separated |
| `genres` | string | Musical genres, comma-separated |
| `bands` | string | Bands, ensembles, or orchestras |
| `awards` | string | Awards and distinctions |
| `teachers` | string | Teachers or mentors |
| `disciples` | string | Students, disciples, or notable pupils |
| `jobs` | string | Professions and professional roles |
| `ranking` | number | Project-specific score; the sample suggests a numeric value, probably within `0–100` |
| `bio` | string | Relative path to the Markdown biography document |
| `url` | string | External reference or canonical source URL |

The current file uses strings for multi-value fields. A future normalized format may use arrays, but parsers should support the current representation first.

Example list normalization:

```text
"rock,pop" → ["rock", "pop"]
```

Recommended parsing rule:

```text
split by comma → trim whitespace → remove empty values
```

---

## `media`

### Photos

```json
"photos": [
  {
    "label": "main Photo",
    "target": "/characters/vesper-reed.jpg"
  }
]
```

| Field | Type | Meaning |
|---|---:|---|
| `label` | string | Human-readable caption or image role |
| `target` | string | Relative path or URL of the image |

The first photo may be treated as the primary portrait when no explicit `primary` flag exists.

### Music

```json
"music": [
  {
    "label": "Love song",
    "target": "/music/song.mp3"
  }
]
```

| Field | Type | Meaning |
|---|---:|---|
| `label` | string | Track title or descriptive label |
| `target` | string | Relative path or URL of an audio resource |

A renderer should determine playback support from the file extension or returned MIME type rather than from the label.

---

## `documents`

```json
"documents": [
  {
    "label": "Expulsion hearing",
    "type": "TRANSCRIPT",
    "target": "embedded"
  }
]
```

| Field | Type | Meaning |
|---|---:|---|
| `label` | string | Display title |
| `type` | string | Document category, preferably an uppercase symbolic value |
| `target` | string | File path, URL, document identifier, slug, or the special value `embedded` |

Observed document types:

- `TRANSCRIPT`
- `DOSSIER`

The application should not hard-code only these two values. Unknown document types should still be displayed using a generic document icon and label.

Suggested interpretation of `target`:

| Value form | Interpretation |
|---|---|
| `embedded` | Document content is stored or rendered inside the biography entry |
| Relative path | Load a local file |
| Absolute URL | Open or fetch an external resource |
| Slug or identifier | Resolve through the application's document registry |

---

## Recommended complete template

```json
{
  "metadata": {
    "id": "0001",
    "title": "Display Name",
    "birthname": "Full Birth Name",
    "gender": "m",
    "type": "guitarist",
    "surname": "Surname",
    "forename": "Forename",
    "country": "RU",
    "birthplace": "City",
    "deathplace": "City",
    "dates": {
      "born": "11.02.1920",
      "died": "11.02.1990",
      "activeFrom": "11.02.1940",
      "activeTo": "11.02.1980"
    },
    "relatives": "Person One,Person Two",
    "instruments": "guitar",
    "genres": "classical,folk",
    "bands": "Ensemble Name",
    "awards": "Award Name",
    "teachers": "Teacher Name",
    "disciples": "Student Name",
    "jobs": "Guitarist,Composer",
    "ranking": 50,
    "bio": "biography.md",
    "url": "https://example.org/source"
  },
  "media": {
    "photos": [
      {
        "label": "Main portrait",
        "target": "/images/person/main.jpg"
      }
    ],
    "music": [
      {
        "label": "Recording title",
        "target": "/music/recording.mp3"
      }
    ]
  },
  "documents": [
    {
      "label": "Document title",
      "type": "ARTICLE",
      "target": "/documents/article.pdf"
    }
  ]
}
```

---

## Minimal valid entry

```json
{
  "metadata": {
    "id": "0001",
    "title": "Display Name",
    "type": "guitarist",
    "bio": "biography.md"
  },
  "media": {
    "photos": [],
    "music": []
  },
  "documents": []
}
```

This is a practical minimum inferred from the intended UI, not a formally validated requirement.

---

## Parsing procedure

1. Read the file as UTF-8.
2. Parse it with a standard JSON parser.
3. Verify that the root value is an object.
4. Read `metadata`, `media`, and `documents` independently.
5. Validate required application fields such as `metadata.id`, `metadata.title`, and `metadata.bio`.
6. Parse dates explicitly as `DD.MM.YYYY`; do not pass them directly to JavaScript `Date`.
7. Normalize comma-separated list fields only when the UI needs arrays.
8. Resolve relative media/document paths against the configurable resource
   base (default: `/pages`), independently of the application's deployment
   base. This rule applies to per-entry JSON, not to `index.json`.
9. Ignore or preserve unknown fields rather than rejecting the complete document.
10. Render missing optional values as absent rows, not as empty labels.

---

## JavaScript / TypeScript parsing example

```ts
type MetadataFile = {
  metadata: {
    id: string;
    title: string;
    bio: string;
    dates?: {
      born?: string;
      died?: string;
      activeFrom?: string;
      activeTo?: string;
    };
    [key: string]: unknown;
  };
  media?: {
    photos?: Array<{ label: string; target: string }>;
    music?: Array<{ label: string; target: string }>;
  };
  documents?: Array<{
    label: string;
    type: string;
    target: string;
  }>;
};

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(v => v.trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value.split(",").map(v => v.trim()).filter(Boolean);
}

function parseMetadata(jsonText: string): MetadataFile {
  const value: unknown = JSON.parse(jsonText);

  if (!value || typeof value !== "object") {
    throw new Error("MetaData.json root must be an object");
  }

  const data = value as Partial<MetadataFile>;

  if (!data.metadata?.id || !data.metadata.title || !data.metadata.bio) {
    throw new Error("Missing metadata.id, metadata.title, or metadata.bio");
  }

  return {
    metadata: data.metadata,
    media: {
      photos: data.media?.photos ?? [],
      music: data.media?.music ?? []
    },
    documents: data.documents ?? []
  };
}
```

---

## UI mapping

| UI tab | JSON source |
|---|---|
| `Biography` | Markdown file referenced by `metadata.bio` |
| `Gallery` | `media.photos` and optionally `media.music` |
| `Documents` | `documents` |
| `Lore` / `Attributes` | Fields inside `metadata` |

The Lore tab should generate rows dynamically from available metadata instead of relying on a fixed set of fields. Technical fields such as `id`, `bio`, and `url` may be hidden or presented separately.

---

## Compatibility guidance

For the current format:

- accept strings for list-like fields;
- tolerate absent optional sections;
- accept unknown metadata keys;
- preserve leading zeroes in `id`;
- resolve local paths without rewriting them;
- avoid automatic date conversion that may change day and month order.

For a future revision, arrays would be preferable for `genres`, `instruments`, `bands`, `awards`, `teachers`, `disciples`, `jobs`, and `relatives`. Such a change should be versioned or supported alongside the current string form.
