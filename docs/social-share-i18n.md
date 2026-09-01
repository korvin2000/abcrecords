# Social Share URL Template & i18n Guide
## Reverse-engineering the legacy `share42` block and a reliable 2026 implementation

**Research date:** 2026-09-01  
**Purpose:** reusable implementation/documentation for an LLM or developer building a share block/menu for localized websites.

---

## 1. Executive summary

The supplied `share42` HTML is an old-style social sharing widget. It does not use one common sharing API. Instead, it contains a small **registry of service-specific HTTP GET URL templates**:

1. take the page URL;
2. take localized title/description text;
3. UTF-8 percent-encode each query-parameter value;
4. concatenate the service-specific endpoint and parameter names;
5. open the resulting URL in a popup/new tab.

The Russian text is not using a special “Russian encoding”. It is ordinary Unicode/UTF-8 serialized as URL percent encoding.

Decoded values from the supplied block:

```text
URL:
https://www.abc-guitars.com/

Title:
ABC-GUITARS -- Иллюстрированный биографический энциклопедический словарь "Гитаристы и композиторы"

Description:
Иллюстрированный биографический энциклопедический словарь.
Электронная энциклопедия гитаристов: статьи, биографии, документы
и материалы о гитаристах и историках гитары
```

Example:

```text
%D0%98%D1%81%D1%82%D0%BE%D1%80%D0%B8%D1%8F
```

decodes to:

```text
История
```

### 2026 conclusion

Keep the **architecture** of the old block — a service registry plus a generic popup handler — but replace its implementation:

- use `https://`;
- use `URL` + `URLSearchParams`, not hand-built percent encoding;
- use localized source strings, never pre-encoded strings;
- use page Open Graph metadata for share previews;
- use `noopener,noreferrer` for external popups;
- use current endpoints where documented;
- remove dead services from the production UI;
- use the Web Share API as the preferred generic share action where available.

Services from the supplied block:

| Service | 2026 recommendation | Notes |
|---|---|---|
| VK | **Keep** | `https://vk.com/share.php`; URL/title-style sharing remains widely used. |
| Facebook | **Keep** | Use `https://www.facebook.com/sharer/sharer.php?u=...`; preview comes from page Open Graph metadata. |
| X / Twitter | **Keep** | `https://twitter.com/intent/tweet?text=...&url=...` remains a practical fallback and is still used by current web.dev documentation. |
| LiveJournal | **Optional / legacy** | Service is active; `update.bml?subject=...&event=...` still appears in current integrations. |
| Одноклассники / OK | **Keep** | Current official endpoint: `https://connect.ok.ru/offer?url=...&title=...&imageUrl=...`. |
| Мой Мир / Mail.ru | **Legacy / verify before enabling** | Mail.ru still publishes legacy share API documentation, but this integration is old and should be feature-flagged/tested. |
| Memori.ru | **Remove** | The old Russian social-bookmarking endpoint could not be verified as a current service. Do not confuse it with modern unrelated products named “Memori”. |
| Google+ | **Remove** | Consumer Google+ shut down on 2019-04-02; its web integrations stopped functioning in March 2019. |

---

# 2. What the original HTML is doing

The supplied HTML is effectively equivalent to this abstract code:

```js
const shareData = {
  url: "https://www.abc-guitars.com/",
  title: "Abc-Guitars.com - Гитаристы и композиторы",
  description:
    "Иллюстрированный биографический энциклопедический словарь.",
};

const services = {
  vk: {
    endpoint: "http://vk.com/share.php",
    params: {
      url: shareData.url,
      title: shareData.title,
      description: shareData.description,
    },
  },

  facebook: {
    endpoint: "http://www.facebook.com/sharer.php",
    params: {
      u: shareData.url,
    },
  },

  twitter: {
    endpoint: "https://twitter.com/intent/tweet",
    params: {
      text: shareData.title,
      url: shareData.url,
    },
  },

  livejournal: {
    endpoint: "http://www.livejournal.com/update.bml",
    params: {
      event: shareData.url,
      subject: shareData.title,
    },
  },

  odnoklassniki: {
    endpoint: "http://www.odnoklassniki.ru/dk",
    params: {
      "st.cmd": "addShare",
      "st._surl": shareData.url,
      title: shareData.title,
    },
  },

  mailru: {
    endpoint: "http://connect.mail.ru/share",
    params: {
      url: shareData.url,
      title: shareData.title,
      description: shareData.description,
    },
  },

  memori: {
    endpoint: "http://memori.ru/link/",
    params: {
      sm: "1",
      "u_data[url]": shareData.url,
      "u_data[name]": shareData.title,
    },
  },

  googlePlus: {
    endpoint: "https://plus.google.com/share",
    params: {
      url: shareData.url,
    },
  },
};
```

The original source pre-computes the encoded query strings server-side or in a library and writes them directly into the HTML.

The rest is presentation:

```html
<a
  rel="nofollow"
  href="#"
  onclick="window.open(SHARE_URL, '_blank', POPUP_OPTIONS); return false"
  title="Localized label"
></a>
```

and a sprite image:

```css
background: url(https://www.abc-guitars.com/js/icons.png) -32px 0 no-repeat;
```

Each icon is a 16×16 region in the sprite.

---

# 3. The core data model

Use one normalized object for every service:

```ts
export interface ShareData {
  url: string;
  title: string;
  text?: string;
  description?: string;
  image?: string;
  locale?: string;
}
```

Recommended semantic meaning:

- `url` — canonical absolute URL of the page being shared.
- `title` — concise localized title.
- `text` — short user-facing share message, e.g. “Read this biography”.
- `description` — page/share-card description.
- `image` — absolute preview-image URL.
- `locale` — active locale, e.g. `ru`, `de`, `en`, `fr`.

Do **not** store percent-encoded values in your i18n files.

Correct:

```json
{
  "share.message": "Прочитайте эту биографию",
  "share.vk": "Поделиться во ВКонтакте"
}
```

Wrong:

```json
{
  "share.message": "%D0%9F%D1%80%D0%BE%D1%87%D0%B8%D1%82%D0%B0%D0%B9%D1%82%D0%B5..."
}
```

Encoding belongs only to the URL-construction layer.

---

# 4. Reliable query-string construction

## Recommended JavaScript implementation

```js
function buildUrl(base, params) {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}
```

Usage:

```js
const shareUrl = buildUrl("https://twitter.com/intent/tweet", {
  text: "Прочитайте биографию Андреса Сеговии",
  url: "https://example.org/ru/segovia?from=encyclopedia",
});
```

`URLSearchParams` performs query serialization and percent encoding. Pass it **raw Unicode strings**. Do not call `encodeURIComponent()` first and then pass the encoded value to `URLSearchParams`, because that will encode `%` again and produce double encoding.

Example of the problem:

```js
const p = new URLSearchParams();
p.set("text", encodeURIComponent("История"));
// WRONG: "%" characters from the first encoding are encoded again.
```

Correct:

```js
const p = new URLSearchParams();
p.set("text", "История");
```

This safely handles:

```text
Русский
Deutsch: Größe & Ästhetik
Français: l’histoire
Español: música y biografía
日本語
中文
? & = # + %
```

### `%20` versus `+`

Both may appear in URL query serialization. `URLSearchParams` serializes spaces as `+` according to `application/x-www-form-urlencoded`. A manually encoded URL may use `%20`. For ordinary share endpoints both represent a space after query parsing.

Do not depend on the visual form of the serialized URL. Depend on correct decoding.

---

# 5. Service templates

## 5.1 VK

### Practical template

```text
https://vk.com/share.php
  ?url={URL}
  &title={TITLE}
  &description={DESCRIPTION}
  &image={IMAGE_URL}
```

JavaScript:

```js
function shareVk(data) {
  return buildUrl("https://vk.com/share.php", {
    url: data.url,
    title: data.title,
    description: data.description,
    image: data.image,
  });
}
```

Minimal robust version:

```js
buildUrl("https://vk.com/share.php", {
  url: data.url,
  title: data.title,
});
```

### Important

Treat explicit `title`, `description`, and `image` parameters as convenience hints, not as your only source of share-card metadata. Also publish correct Open Graph metadata on the target page.

For dynamic pages, page metadata should match the localized route.

---

## 5.2 Facebook

The original block used:

```text
http://www.facebook.com/sharer.php?u={URL}
```

Use the HTTPS sharer form:

```text
https://www.facebook.com/sharer/sharer.php?u={URL}
```

JavaScript:

```js
function shareFacebook(data) {
  return buildUrl("https://www.facebook.com/sharer/sharer.php", {
    u: data.url,
  });
}
```

### Do not try to force custom preview text through the sharer URL

Historically Facebook accepted or partially accepted extra parameters. That is not a reliable design.

The share card should come from page metadata:

```html
<meta property="og:title" content="Localized page title">
<meta property="og:description" content="Localized description">
<meta property="og:image" content="https://example.org/media/share/segovia.jpg">
<meta property="og:url" content="https://example.org/ru/segovia">
<meta property="og:type" content="article">
```

A user may add/edit their own comment in Facebook’s composer. Do not design around pre-filling that comment.

---

## 5.3 X / Twitter

A reliable current fallback remains:

```text
https://twitter.com/intent/tweet
  ?text={TEXT}
  &url={URL}
```

JavaScript:

```js
function shareX(data) {
  return buildUrl("https://twitter.com/intent/tweet", {
    text: data.text || data.title,
    url: data.url,
  });
}
```

Optional legacy Web Intent parameters commonly include:

```text
via
hashtags
related
in_reply_to
```

Example:

```js
return buildUrl("https://twitter.com/intent/tweet", {
  text: "Прочитайте биографию Андреса Сеговии",
  url: "https://example.org/ru/segovia",
  hashtags: "guitar,Segovia",
});
```

If exact text ordering matters, place the complete message — including the URL or hashtag — in `text`; otherwise the platform may compose fields in its preferred order.

Do not assume that the visible brand/domain must permanently remain `twitter.com`; keep endpoints in a registry so they can be updated independently.

---

## 5.4 LiveJournal

The supplied mechanism:

```text
https://www.livejournal.com/update.bml
  ?subject={TITLE}
  &event={CONTENT}
```

Basic version:

```js
function shareLiveJournal(data) {
  return buildUrl("https://www.livejournal.com/update.bml", {
    subject: data.title,
    event: data.url,
  });
}
```

More useful version:

```js
function shareLiveJournal(data) {
  const body = `${data.text || data.description || data.title}\n\n${data.url}`;

  return buildUrl("https://www.livejournal.com/update.bml", {
    subject: data.title,
    event: body,
  });
}
```

Older integrations sometimes put HTML in `event`, e.g. an `<a href="...">` link. Prefer plain text unless you have tested current LiveJournal handling and specifically need HTML.

LiveJournal itself remains online as of the research date.

---

## 5.5 Одноклассники / OK

Do **not** copy the old endpoint from the supplied HTML.

Old:

```text
http://www.odnoklassniki.ru/dk
  ?st.cmd=addShare
  &st._surl={URL}
  &title={TITLE}
```

Current official API documentation provides:

```text
https://connect.ok.ru/offer
  ?url={URL}
  &title={TITLE}
  &imageUrl={IMAGE_URL}
```

Only `url` is required; `title` and `imageUrl` are optional.

JavaScript:

```js
function shareOk(data) {
  return buildUrl("https://connect.ok.ru/offer", {
    url: data.url,
    title: data.title,
    imageUrl: data.image,
  });
}
```

OK also recommends Open Graph or OExchange metadata so its crawler can select the correct media.

---

## 5.6 Мой Мир / Mail.ru

The supplied block uses:

```text
http://connect.mail.ru/share
  ?url={URL}
  &title={TITLE}
  &description={DESCRIPTION}
  &imageurl=null
```

Mail.ru’s published legacy API documentation describes:

```text
http://connect.mail.ru/share
  ?url={URL}
  &title={TITLE}
  &description={DESCRIPTION}
  &image_url={IMAGE_URL}
```

Note the documented key:

```text
image_url
```

not:

```text
imageurl
```

Recommended compatibility implementation:

```js
function shareMailRu(data) {
  return buildUrl("https://connect.mail.ru/share", {
    url: data.url,
    title: data.title,
    description: data.description,
    image_url: data.image,
  });
}
```

### 2026 policy

Treat this as a **legacy connector**:

- keep it behind a feature flag;
- test it periodically;
- do not make your generic sharing architecture depend on it;
- prefer page metadata over service-specific title/description overrides.

---

## 5.7 Memori.ru

The old block uses:

```text
http://memori.ru/link/
  ?sm=1
  &u_data[url]={URL}
  &u_data[name]={TITLE}
```

This was a Russian social-bookmarking service.

For a 2026 implementation:

```text
STATUS: unsupported / remove
```

Do not confuse the historical `memori.ru` service with modern unrelated products named “Memori”.

If preservation of a historical website is required, keep its definition only in a disabled `legacyServices` registry.

---

## 5.8 Google+

The old block uses:

```text
https://plus.google.com/share?url={URL}
```

Do not include it.

Consumer Google+ shut down on **2019-04-02**. Google+ web/mobile integrations and Google+ Sign-In stopped functioning in March 2019.

Use a generic Web Share / Copy Link action instead.

---

# 6. Recommended production architecture

Keep service knowledge in data rather than scattered through markup.

```ts
type ShareBuilder = (data: ShareData) => string;

interface ShareService {
  id: string;
  labelKey: string;
  enabled: boolean;
  build: ShareBuilder;
}
```

Example:

```js
const SHARE_SERVICES = [
  {
    id: "vk",
    labelKey: "share.vk",
    enabled: true,
    build: (d) =>
      buildUrl("https://vk.com/share.php", {
        url: d.url,
        title: d.title,
        description: d.description,
        image: d.image,
      }),
  },

  {
    id: "facebook",
    labelKey: "share.facebook",
    enabled: true,
    build: (d) =>
      buildUrl("https://www.facebook.com/sharer/sharer.php", {
        u: d.url,
      }),
  },

  {
    id: "x",
    labelKey: "share.x",
    enabled: true,
    build: (d) =>
      buildUrl("https://twitter.com/intent/tweet", {
        text: d.text || d.title,
        url: d.url,
      }),
  },

  {
    id: "livejournal",
    labelKey: "share.livejournal",
    enabled: true,
    build: (d) =>
      buildUrl("https://www.livejournal.com/update.bml", {
        subject: d.title,
        event: `${d.text || d.description || d.title}\n\n${d.url}`,
      }),
  },

  {
    id: "ok",
    labelKey: "share.ok",
    enabled: true,
    build: (d) =>
      buildUrl("https://connect.ok.ru/offer", {
        url: d.url,
        title: d.title,
        imageUrl: d.image,
      }),
  },

  {
    id: "mailru",
    labelKey: "share.mailru",
    enabled: false, // enable only after current integration testing
    build: (d) =>
      buildUrl("https://connect.mail.ru/share", {
        url: d.url,
        title: d.title,
        description: d.description,
        image_url: d.image,
      }),
  },
];
```

This gives you:

- centralized endpoint maintenance;
- one encoding implementation;
- easy service feature flags;
- simple testing;
- no duplicated popup code;
- easy React/Vue/plain-JS integration.

---

# 7. Generic popup handler

Do not put large JavaScript expressions inside `onclick`.

Use a normal event listener:

```js
function openSharePopup(url) {
  const width = 640;
  const height = 620;

  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  window.open(
    url,
    "_blank",
    [
      "popup=yes",
      "noopener=yes",
      "noreferrer=yes",
      "resizable=yes",
      "scrollbars=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
    ].join(",")
  );
}
```

For a normal anchor:

```html
<a
  href="GENERATED_SHARE_URL"
  target="_blank"
  rel="nofollow noopener noreferrer"
>
  Share
</a>
```

Keeping a real `href` provides a graceful fallback if JavaScript is unavailable.

For buttons generated by JavaScript:

```js
button.addEventListener("click", () => {
  openSharePopup(service.build(shareData));
});
```

---

# 8. Preferred 2026 top-level action: Web Share API

Where supported, a generic “Share” button can use the operating system/browser share sheet:

```js
async function nativeShare(data) {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: data.title,
      text: data.text || data.description,
      url: data.url,
    });
    return true;
  } catch (error) {
    if (error?.name === "AbortError") return true;
    return false;
  }
}
```

Typical strategy:

```text
Share button clicked
        |
        v
navigator.share available?
   | yes              | no
   v                  v
native share     custom share menu
                    |
          +---------+----------+
          |         |          |
          VK       X/FB       Copy Link
```

Requirements/limitations:

- `navigator.share()` requires a secure context in supporting browsers;
- it must be triggered by user activation;
- available share targets depend on the user’s OS/device/browser;
- support is not universal, so retain a fallback.

This is preferable to maintaining a huge list of social networks.

---

# 9. Localized i18n share messages

Keep UI labels and share text separate.

Example English:

```json
{
  "share": {
    "button": "Share",
    "copy": "Copy link",
    "vk": "Share on VK",
    "facebook": "Share on Facebook",
    "x": "Share on X",
    "ok": "Share on Odnoklassniki",
    "livejournal": "Share on LiveJournal",
    "message": "Read “{title}” on Guitar Times"
  }
}
```

Russian:

```json
{
  "share": {
    "button": "Поделиться",
    "copy": "Скопировать ссылку",
    "vk": "Поделиться во ВКонтакте",
    "facebook": "Поделиться в Facebook",
    "x": "Поделиться в X",
    "ok": "Поделиться в Одноклассниках",
    "livejournal": "Опубликовать в LiveJournal",
    "message": "Прочитайте «{title}» на Guitar Times"
  }
}
```

German:

```json
{
  "share": {
    "button": "Teilen",
    "copy": "Link kopieren",
    "vk": "Auf VK teilen",
    "facebook": "Auf Facebook teilen",
    "x": "Auf X teilen",
    "ok": "Auf Odnoklassniki teilen",
    "livejournal": "Auf LiveJournal teilen",
    "message": "„{title}“ auf Guitar Times lesen"
  }
}
```

Runtime:

```js
const shareData = {
  url: getCanonicalUrl(),
  title: pageTitle,
  text: t("share.message", { title: pageTitle }),
  description: pageDescription,
  image: pageShareImage,
  locale: i18n.language,
};
```

The translation system produces Unicode strings. The URL builder encodes them later.

---

# 10. Canonical URL

Prefer the page’s canonical URL rather than blindly sharing `location.href`.

```js
function getCanonicalUrl() {
  const canonical = document.querySelector('link[rel="canonical"]');
  return canonical?.href || location.href;
}
```

Why:

```text
https://example.org/ru/segovia?utm_source=x
https://example.org/ru/segovia#discography
https://example.org/ru/segovia?debug=true
```

may all represent the same canonical article:

```text
https://example.org/ru/segovia
```

For language-specific pages, the canonical URL normally remains the URL for the active localized page unless your SEO architecture intentionally canonicalizes languages differently.

---

# 11. Open Graph metadata is part of the sharing system

A share URL is only half of the implementation.

The destination page should expose metadata such as:

```html
<head>
  <title>Андрес Сеговия — биография</title>

  <meta
    name="description"
    content="Биография Андреса Сеговии, история жизни, творчество и записи."
  >

  <link
    rel="canonical"
    href="https://example.org/ru/biographies/andres-segovia"
  >

  <meta property="og:type" content="article">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="Андрес Сеговия — биография">
  <meta
    property="og:description"
    content="Биография Андреса Сеговии, история жизни, творчество и записи."
  >
  <meta
    property="og:url"
    content="https://example.org/ru/biographies/andres-segovia"
  >
  <meta
    property="og:image"
    content="https://example.org/media/share/andres-segovia.jpg"
  >
</head>
```

The Open Graph protocol defines the core fields:

```text
og:title
og:type
og:image
og:url
```

`og:description` is also strongly useful for sharing cards.

### SPA warning

If the site is a client-rendered SPA, do not assume every social crawler will execute your React/Vue JavaScript and wait for metadata changes.

For reliable previews, provide share metadata in the HTML response via one of:

- SSR;
- SSG/prerendering;
- an edge/server metadata renderer;
- crawler-specific rendered routes only if implemented carefully and without content mismatch.

The social crawler should receive the correct localized metadata directly from the requested URL.

---

# 12. HTML template: progressive enhancement

```html
<nav class="share-menu" aria-label="Share this page">
  <button type="button" data-share-native>
    Share
  </button>

  <a data-share="vk" target="_blank" rel="nofollow noopener noreferrer">
    VK
  </a>

  <a data-share="facebook" target="_blank" rel="nofollow noopener noreferrer">
    Facebook
  </a>

  <a data-share="x" target="_blank" rel="nofollow noopener noreferrer">
    X
  </a>

  <a data-share="ok" target="_blank" rel="nofollow noopener noreferrer">
    Одноклассники
  </a>

  <button type="button" data-share-copy>
    Copy link
  </button>
</nav>
```

Initialization:

```js
function initShareMenu(root, shareData, services) {
  for (const service of services) {
    if (!service.enabled) continue;

    const link = root.querySelector(`[data-share="${service.id}"]`);
    if (!link) continue;

    link.href = service.build(shareData);

    link.addEventListener("click", (event) => {
      event.preventDefault();
      openSharePopup(link.href);
    });
  }

  root.querySelector("[data-share-native]")?.addEventListener("click", async () => {
    const usedNativeShare = await nativeShare(shareData);

    if (!usedNativeShare) {
      root.classList.toggle("share-menu--expanded", true);
    }
  });

  root.querySelector("[data-share-copy]")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(shareData.url);
  });
}
```

---

# 13. React-oriented implementation

```tsx
type ShareData = {
  url: string;
  title: string;
  text?: string;
  description?: string;
  image?: string;
};

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const url = new URL(base);

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}

const builders = {
  vk: (d: ShareData) =>
    buildUrl("https://vk.com/share.php", {
      url: d.url,
      title: d.title,
      description: d.description,
      image: d.image,
    }),

  facebook: (d: ShareData) =>
    buildUrl("https://www.facebook.com/sharer/sharer.php", {
      u: d.url,
    }),

  x: (d: ShareData) =>
    buildUrl("https://twitter.com/intent/tweet", {
      text: d.text ?? d.title,
      url: d.url,
    }),

  ok: (d: ShareData) =>
    buildUrl("https://connect.ok.ru/offer", {
      url: d.url,
      title: d.title,
      imageUrl: d.image,
    }),
};
```

Component:

```tsx
function ShareLink({
  service,
  data,
  children,
}: {
  service: keyof typeof builders;
  data: ShareData;
  children: React.ReactNode;
}) {
  const href = builders[service](data);

  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        openSharePopup(href);
      }}
    >
      {children}
    </a>
  );
}
```

The share module can be lazy-loaded with the menu if it is not needed in the initial application bundle.

---

# 14. What not to copy from the legacy block

## 14.1 Do not hard-code giant encoded strings

Bad:

```html
onclick="window.open('https://...?title=%D0%98%D0%A1%D0%A2%D0%9E...')"
```

Problems:

- unreadable;
- difficult to localize;
- easy to double-encode;
- duplicates content;
- poor maintainability;
- mixes data, business logic, UI and popup behavior.

---

## 14.2 Do not use HTTP endpoints when HTTPS exists

Legacy code contains:

```text
http://vk.com/
http://www.facebook.com/
http://www.livejournal.com/
http://www.odnoklassniki.ru/
http://connect.mail.ru/
http://memori.ru/
```

Use HTTPS endpoints.

---

## 14.3 Do not depend on arbitrary custom text parameters

Different social platforms decide what can be prefilled.

Separate:

```text
share composer text
```

from:

```text
link preview metadata
```

Preview metadata should primarily come from the target page.

---

## 14.4 Do not send `"null"` as an image

The source contains:

```text
imageurl=null
```

That is a literal string, not absence of a value.

Prefer omitting an unavailable parameter:

```js
if (data.image) {
  url.searchParams.set("image_url", data.image);
}
```

---

## 14.5 Do not use `href="#"` as the only navigation mechanism

Provide the actual URL in `href` when practical.

This improves:

- no-JS behavior;
- accessibility;
- browser affordances;
- testing;
- inspectability.

---

# 15. Testing matrix

For each enabled provider, test at least:

```text
[ ] ASCII English title
[ ] Russian/Cyrillic
[ ] German umlauts / ß
[ ] French accents
[ ] CJK
[ ] apostrophes and quotes
[ ] ampersand &
[ ] hash #
[ ] plus +
[ ] percent %
[ ] URL with its own ?query=1&value=2
[ ] very long title
[ ] missing description
[ ] missing image
[ ] localized canonical URL
[ ] mobile browser
[ ] desktop browser
[ ] popup blocked/fallback behavior
```

Programmatic unit test example:

```js
const data = {
  url: "https://example.org/ru/item?a=1&b=два#part",
  title: "История гитары: XVIII–XX вв. & «лица»",
};

const result = buildUrl("https://twitter.com/intent/tweet", {
  text: data.title,
  url: data.url,
});

const parsed = new URL(result);

console.assert(parsed.searchParams.get("text") === data.title);
console.assert(parsed.searchParams.get("url") === data.url);
```

Test **decoded semantics**, not exact serialized `%20`/`+` formatting.

---

# 16. Recommended service policy

A maintainable share menu should not attempt to preserve every historical network forever.

Recommended tiers:

```text
Tier A — primary
  Native Web Share
  Copy Link

Tier B — explicit networks
  VK
  Facebook
  X
  Odnoklassniki

Tier C — audience-specific / optional
  LiveJournal
  Mail.ru

Removed
  Google+
  Memori.ru
```

The exact visible set should be configurable per locale or audience.

Example:

```js
const servicesByLocale = {
  ru: ["vk", "ok", "facebook", "x", "livejournal"],
  de: ["facebook", "x"],
  en: ["facebook", "x"],
};
```

Do not infer that a user wants a network merely from locale. Treat this as product configuration, not identity inference.

---

# 17. LLM implementation instructions

Use the following specification when asking an LLM/coding agent to build a share menu.

## Task

Implement a localized social share menu for a web application.

## Required architecture

1. Define one normalized `ShareData` object:
   - `url`
   - `title`
   - `text`
   - `description`
   - `image`
   - `locale`

2. Define service URL builders in one registry.

3. Build query strings with:
   - `new URL(...)`
   - `url.searchParams.set(...)`
   - raw Unicode input

4. Never manually concatenate already percent-encoded i18n strings.

5. Never encode a value twice.

6. Use:
   - VK: `https://vk.com/share.php`
   - Facebook: `https://www.facebook.com/sharer/sharer.php?u=...`
   - X/Twitter: `https://twitter.com/intent/tweet`
   - LiveJournal: `https://www.livejournal.com/update.bml`
   - OK: `https://connect.ok.ru/offer`
   - Mail.ru only as an optional legacy provider

7. Do not implement:
   - Google+
   - historical Memori.ru

8. Use `navigator.share()` as the preferred generic action when available.

9. Provide “Copy link” fallback.

10. Open external share dialogs with `noopener`/`noreferrer`.

11. Use actual generated URLs in anchor `href` values.

12. Add localized accessible labels/`aria-label`s.

13. Obtain share preview title/description/image primarily from page Open Graph metadata.

14. Ensure localized Open Graph metadata is present in the initial HTML response where social crawlers can read it.

15. Use the canonical localized page URL.

## Constraints

- no third-party social-share library unless justified;
- no inline `onclick`;
- no hard-coded percent-encoded language text;
- no obsolete Google+ implementation;
- no literal `image=null`;
- no duplicated URL-building logic.

## Acceptance tests

The final implementation must correctly round-trip:

```text
Russian Cyrillic
German umlauts
French accents
CJK
&, #, +, %, ?, =
URLs containing their own query strings
```

Verify results by parsing generated URLs with `new URL()` and comparing `searchParams.get(...)` to the original Unicode values.

---

# 18. Compact final template

```js
export const buildShareUrl = (base, params) => {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
};

export const shareProviders = {
  vk: (d) =>
    buildShareUrl("https://vk.com/share.php", {
      url: d.url,
      title: d.title,
      description: d.description,
      image: d.image,
    }),

  facebook: (d) =>
    buildShareUrl("https://www.facebook.com/sharer/sharer.php", {
      u: d.url,
    }),

  x: (d) =>
    buildShareUrl("https://twitter.com/intent/tweet", {
      text: d.text || d.title,
      url: d.url,
    }),

  livejournal: (d) =>
    buildShareUrl("https://www.livejournal.com/update.bml", {
      subject: d.title,
      event: `${d.text || d.description || d.title}\n\n${d.url}`,
    }),

  ok: (d) =>
    buildShareUrl("https://connect.ok.ru/offer", {
      url: d.url,
      title: d.title,
      imageUrl: d.image,
    }),

  mailru: (d) =>
    buildShareUrl("https://connect.mail.ru/share", {
      url: d.url,
      title: d.title,
      description: d.description,
      image_url: d.image,
    }),
};

export function openShare(url) {
  window.open(
    url,
    "_blank",
    "popup=yes,noopener=yes,noreferrer=yes,resizable=yes,scrollbars=yes,width=640,height=620"
  );
}
```

Recommended caller:

```js
const shareData = {
  url: document.querySelector('link[rel="canonical"]')?.href || location.href,
  title: localizedPageTitle,
  text: t("share.message", { title: localizedPageTitle }),
  description: localizedPageDescription,
  image: absoluteShareImageUrl,
  locale: activeLocale,
};

openShare(shareProviders.vk(shareData));
```

---

# 19. Sources and current-status notes

## URL construction / Web platform

- MDN — `URLSearchParams`:  
  https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
- MDN — `Navigator.share()`:  
  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- MDN — Web Share API:  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
- MDN — `rel="noopener"`:  
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener
- web.dev — “How to let the user share the website they are on”, updated 2026-07-29:  
  https://web.dev/articles/web-apps/share

## Open Graph

- The Open Graph protocol:  
  https://ogp.me/

## Odnoklassniki

- Official Like/Share documentation and direct share endpoint:  
  https://apiok.ru/en/ext/like
- Russian version:  
  https://apiok.ru/ext/like

The official documentation explicitly describes:

```text
https://connect.ok.ru/offer?url=URL_TO_SHARE&title=TITLE&imageUrl=IMAGE_URL
```

## Mail.ru

- Legacy official detailed share documentation:  
  https://api.mail.ru/sites/plugins/share/extended/

It documents:

```text
http://connect.mail.ru/share
  ?url=<address>
  &title=<title>
  &description=<description>
  &image_url=<image>
```

Treat this as legacy and verify in the target browsers/accounts before enabling.

## LiveJournal

- Current service status:  
  https://status.livejournal.com/

LiveJournal was operational at the time of research. Current web examples continue to expose `update.bml` share/repost URLs, although a current formal external-share API page was not found.

## X / Twitter

Current web.dev documentation still uses this fallback:

```text
https://twitter.com/intent/tweet
```

with `text` and `url`.

The historical X/Twitter developer documentation URL now redirects into the current X documentation portal, so keep the endpoint isolated in configuration and regression-test it.

## Google+

- Google shutdown FAQ:  
  https://support.google.com/chat/answer/14087009?hl=en
- Google announcement accelerating the shutdown:  
  https://blog.google/technology/safety-security/expediting-changes-google-plus/

Consumer Google+ was shut down on 2019-04-02.

---

# 20. Final design rule

Treat social sharing as three independent layers:

```text
1. Share data
   localized URL/title/text/description/image

2. Page metadata
   canonical + Open Graph, visible to crawlers

3. Provider adapters
   tiny URL builders for VK / Facebook / X / OK / etc.
```

Do not mix these layers.

That is the durable version of the mechanism hidden inside the original `share42` HTML.
