# AWD & RWD: профессиональный Guide, Best Practices и FAQ

**Adaptive Web Design (AWD) + Responsive Web Design (RWD)**  
Версия: 2026-08-29  
Аудитория: senior frontend/UI engineers, UX/product designers, design-system teams, technical leads.

> Цель документа — не повторять базовые определения вроде «используйте media queries», а дать практическую модель принятия решений: где нужен fluid/intrinsic layout, где дискретная перестройка, когда оправдан server-side adaptive delivery, как проектировать брейкпоинты, компоненты, изображения, типографику, доступность и тестирование без привязки к каталогу устройств.
> see also '\RESPONSIVE-RWD-AUDIT.md'

---

## 0. Краткий вывод

Для большинства современных продуктов разумный default — **не рассматривать AWD и RWD как взаимоисключающие архитектуры**, а строить систему из трех уровней:

1. **Fluid / intrinsic RWD** — непрерывная адаптация за счет нормального document flow, Grid/Flex, intrinsic sizing, `min()`, `max()`, `clamp()`, `minmax()`, `auto-fit`, относительных единиц и ограничителей ширины.
2. **Discrete adaptation** — небольшое число точек, где композиция действительно должна измениться: media queries для macro-layout, container queries для компонентов.
3. **Adaptive delivery** — серверные варианты HTML/assets только там, где различается не просто геометрия, а **payload, функциональность или стоимость загрузки** настолько, что это оправдывает дополнительную сложность кэширования, QA и поддержки.

Это можно сформулировать как улучшенную версию идеи **Stretch → Scale → Switch**:

- **Stretch** — по умолчанию; пусть layout решает как можно больше без брейкпоинтов.
- **Scale** — не «масштабировать весь сайт пропорционально», а применять **bounded fluid scaling**: `clamp()` для type/spacing/container widths; иначе UI становится слишком крупным на широких экранах и слишком плотным на узких.
- **Switch** — менять композицию только в точке, где содержимое или interaction model перестает работать.

Главная единица проектирования — не «iPhone / tablet / desktop», а **ограничение**: доступная inline-size, длина текста, плотность элементов, тип pointer, hover capability, zoom, локаль, safe area, высота viewport, состояние контейнера.

---

# 1. Терминология: почему спор AWD vs RWD часто начинается с неправильной модели

Термины используются непоследовательно даже в профессиональных публикациях. Поэтому полезно разделить **две независимые оси**.

## 1.1 Ось A — поведение layout

### Responsive / fluid

Один layout-system непрерывно реагирует на доступное пространство. Типичные механизмы:

- normal flow;
- Flex/Grid;
- intrinsic sizing;
- flexible tracks;
- media/container queries для ограниченного числа discontinuities.

### Adaptive / discrete

Есть несколько намеренно различных состояний композиции: например, sidebar становится drawer, toolbar перестраивается в action menu, master-detail превращается в последовательную навигацию.

**Важно:** такая дискретность может быть реализована в одном DOM и одном bundle. То есть визуально система adaptive, а delivery остается responsive/client-side.

## 1.2 Ось B — способ доставки

### Same HTML / same URL

Классический RWD: сервер отдает одинаковую семантическую структуру, CSS/JS адаптируют представление.

### Dynamic serving

Та же URL, но сервер отдает разные HTML/assets в зависимости от client characteristics. Google документирует этот вариант отдельно и требует аккуратной работы с `Vary` и device detection.

### Separate URLs

Например, legacy `m.example.com`. Это отдельная архитектурная модель с дополнительными SEO/canonical/hreflang и maintenance-рисками.

## 1.3 Практическая матрица

| Layout | Delivery | Типичный случай | Рекомендация |
|---|---|---|---|
| Fluid | Same HTML | Контентный сайт, SaaS, SPA | **Default** |
| Fluid + discrete switches | Same HTML | Современный сложный UI | **Лучший default для большинства приложений** |
| Discrete | Dynamic serving | Киоск, embedded device, строго контролируемое железо, radically different payload | Использовать при измеримой выгоде |
| Separate site | Separate URLs | Legacy | Обычно мигрировать, а не выбирать заново |

**Следствие:** вопрос «AWD или RWD?» лучше переформулировать:  
**«Какие свойства должны адаптироваться непрерывно, какие — дискретно, и где адаптацию должен выполнять CSS/component layer, а где — сервер?»**

---

# 2. Когда RWD, AWD и hybrid действительно оправданы

## 2.1 Выбирайте RWD/hybrid как default, если

- множество неизвестных viewport sizes;
- UI живет в resizable desktop windows;
- один компонент используется в разных shell/sidebar/modal/grid contexts;
- важна поддержка zoom 200–400%;
- контент динамический и локализованный;
- обновления частые;
- design system должен масштабироваться на десятки экранов и команд.

## 2.2 AWD становится разумным, если контекст действительно дискретный

Примеры:

- внутренний industrial UI работает только на двух заранее известных терминалах;
- TV/remote интерфейс и touch интерфейс имеют разные navigation models;
- mobile flow функционально короче, потому что часть сложной операции переносится в native capability;
- server-side selection экономит большой payload, и экономия подтверждена RUM/trace, а не предположением;
- legacy desktop application постепенно мигрирует в responsive architecture и временно поддерживает отдельный mobile composition.

## 2.3 Не используйте AWD только ради «pixel-perfect на 6 популярных разрешениях»

Это оптимизация под snapshot каталога устройств. Она ломается на:

- split-screen;
- browser sidebars;
- desktop windowing;
- foldables;
- browser zoom;
- OS text scaling;
- длинных локализованных строках;
- встроенных webviews;
- будущих устройствах.

Если layout зависит от устройства сильнее, чем от **реально доступного пространства**, архитектура обычно слишком хрупкая.

---

# 3. Главный принцип: design constraints, not devices

## 3.1 Breakpoint должен появляться в момент failure

Плохой алгоритм:

```text
Bootstrap имеет 768px → значит и нам нужен breakpoint 768px.
```

Хороший алгоритм:

```text
1. Собрать компонент с максимально fluid поведением.
2. Медленно уменьшать/увеличивать доступную inline-size.
3. Найти первое место, где нарушается инвариант:
   - строка становится слишком длинной/короткой;
   - control group переносится в 2 нечитабельные строки;
   - label конкурирует с value;
   - card теряет полезную иерархию;
   - sidebar оставляет main слишком узким;
   - sticky UI съедает высоту.
4. Только там добавить switch.
```

Такой breakpoint относится к **контенту**, а не к устройству.

## 3.2 Не называйте layout states `mobile/tablet/desktop`

Лучше:

- `compact / regular / wide`;
- `narrow / medium / spacious`;
- `single-column / split / expanded`.

Причина не косметическая. Название `mobile` незаметно тащит ложные предположения: touch, медленная сеть, portrait, маленький экран. Современный ноутбук может иметь touch; телефон — внешний monitor; desktop window может быть 480 CSS px.

## 3.3 Высота — отдельное измерение

Большинство responsive systems проектируют только width. Это ошибка для:

- landscape phones;
- split view;
- notebook screens с крупным browser chrome;
- fixed headers/footers;
- dialogs;
- virtual keyboard.

Проверяйте **short viewport** отдельно. Иногда правильный query — не `width`, а `height`, `aspect-ratio`, container size или комбинация.

---

# 4. Modern responsive architecture: macro vs micro layout

## 4.1 Media queries — для macro-layout

Viewport queries логичны для решений уровня страницы:

- появляется/исчезает persistent sidebar;
- page shell меняет количество областей;
- глобальная навигация меняет модель;
- content frame получает другой max-width.

Современный синтаксис range queries читается лучше:

```css
@media (width >= 64rem) {
  .app-shell { /* ... */ }
}
```

В design system полезно иметь **малое число shell breakpoints**, а не десятки component-specific значений.

## 4.2 Container queries — для micro-layout

Компонент не должен знать ширину viewport. Он должен знать, сколько места дали **ему**.

```css
.card-region {
  container: card / inline-size;
}

.card {
  display: grid;
  gap: 1rem;
}

@container card (width > 34rem) {
  .card {
    grid-template-columns: 10rem 1fr;
    align-items: start;
  }
}
```

Преимущества:

- один card работает в main grid, sidebar, modal, dashboard tile;
- меньше глобальной координации breakpoints;
- component contract становится локальным;
- Storybook/component tests становятся ближе к реальному behavior.

### Практическое правило

**Viewport определяет topology страницы; container определяет morphology компонента.**

## 4.3 Container units (`cqi`, `cqw`) — полезнее `vw` для локальной fluidity

```css
.card-title {
  font-size: clamp(1rem, 0.9rem + 1.2cqi, 1.5rem);
}
```

Так компонент масштабируется относительно своего реального context, а не всего окна.

---

# 5. Intrinsic layout: уменьшайте число breakpoints до того, как писать queries

Современный CSS умеет решать большой класс responsive-задач **без media query**.

## 5.1 Auto-fit grid

```css
.grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: clamp(0.75rem, 1vw + 0.5rem, 1.5rem);
}
```

Почему это лучше фиксированного `3 → 2 → 1 columns`:

- количество колонок является результатом доступного пространства;
- layout работает в неизвестных контейнерах;
- меньше discontinuities;
- нет «мертвой зоны» между искусственными breakpoints.

## 5.2 `minmax(0, 1fr)` против content blowout

Один из частых production bugs: Grid/Flex item не хочет сжиматься из-за intrinsic minimum.

```css
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
}
```

Или для flex child:

```css
.content {
  min-inline-size: 0;
}
```

Это особенно важно для:

- длинных URL;
- таблиц;
- code blocks;
- translated labels;
- `<pre>`;
- непрерывных identifiers.

## 5.3 Overflow — это часто content problem, а не breakpoint problem

Полезный defensive layer:

```css
.prose,
.card,
.form-row {
  overflow-wrap: anywhere;
}
```

Но не маскируйте им ошибочную структуру. Если таблице нужен horizontal dimension для смысла, горизонтальный scroll внутри **локального контейнера** может быть правильнее «responsive cardification».

## 5.4 `fit-content`, `min-content`, `max-content`

Эти primitives часто лучше magic widths:

```css
.toolbar {
  grid-template-columns: max-content minmax(0, 1fr) max-content;
}

.badge {
  inline-size: fit-content;
}
```

Responsive design становится стабильнее, когда размеры выводятся из **intrinsic requirements контента**.

## 5.5 Subgrid

`subgrid` полезен там, где cards/rows должны визуально выравнивать внутренние части по общей сетке, но сами компоненты остаются самостоятельными. Это снимает часть «ручной синхронизации высот», которая раньше порождала JS и brittle fixed heights.

---

# 6. Fluid scaling: что масштабировать, а что нет

Идея «Scale» полезна только с ограничителями.

## 6.1 Не масштабируйте весь UI одним коэффициентом

Глобальное пропорциональное масштабирование ведет к побочным эффектам:

- body text становится чрезмерно большим на ultrawide;
- слишком большие paddings уменьшают information density;
- controls теряют привычные affordances;
- line length растет одновременно с font size;
- design начинает зависеть от viewport, а не от reading/task constraints.

## 6.2 Масштабируйте design tokens по отдельным диапазонам

```css
:root {
  --space-1: clamp(0.5rem, 0.4rem + 0.25vw, 0.75rem);
  --space-3: clamp(1rem, 0.8rem + 0.6vw, 1.5rem);
  --step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem);
  --step-3: clamp(1.75rem, 1.35rem + 1.6vw, 2.75rem);
}
```

Лучше иметь 3–5 fluid scales с разной динамикой, чем один глобальный scale factor.

## 6.3 Используйте `rem` не потому, что «px запрещен»

`px` не является антипаттерном сам по себе. CSS pixel — логическая единица, а не physical pixel.

Полезная политика:

- typography, user-scalable spacing → `rem/em`;
- line measure → `ch`/`rem`;
- hairlines/borders → `px` вполне уместен;
- viewport/container relationships → `%`, `fr`, `vi`, `cqi`;
- bounded fluid values → `clamp()`.

**Антипаттерн — не `px`, а fixed geometry там, где constraint должен быть fluid.**

---

# 7. Typography: responsive ≠ «шрифт уменьшается на телефоне»

## 7.1 Ограничивайте measure, а не растягивайте текст на весь wide screen

```css
.prose {
  max-inline-size: 68ch;
}
```

Для длинного чтения line length важнее заполнения пустого пространства. WCAG 2.2 AAA использует 80 characters/glyphs как верхнюю границу в своем механизме Visual Presentation; это хороший ориентир, но не догма для любого UI.

## 7.2 Fluid type должен сохранять browser zoom semantics

```css
h1 {
  font-size: clamp(2rem, 1.4rem + 2vw, 3.5rem);
}
```

Не делайте центральный терм только `vw`. Чистый viewport-based type может плохо реагировать на user font settings и создать слишком малый диапазон на narrow widths.

## 7.3 Проверяйте реальные строки, а не lorem ipsum

Минимальный набор:

- короткий English;
- длинный German;
- русский;
- CJK;
- длинные proper names;
- числа + currency + units;
- unbreakable IDs/URLs;
- user-generated content.

Localization является **responsive stress test**.

## 7.4 Не фиксируйте высоту text containers

`height: 48px` + «ровно две строки» — типичный источник clipping при:

- zoom;
- font substitution;
- translated content;
- OS text settings.

Если нужна визуальная унификация карточек, используйте Grid/Subgrid, min-height только как lower bound, а не hard clipping.

---

# 8. Images/media: responsiveness как resource selection, а не только `max-width: 100%`

## 8.1 Три разные задачи

1. **Layout scaling** — изображение не переполняет контейнер.
2. **Resolution switching** — браузер выбирает подходящий размер файла.
3. **Art direction** — меняется crop/композиция изображения.

Не смешивайте их.

## 8.2 `srcset` бесполезен без корректного `sizes`

```html
<img
  src="photo-800.avif"
  srcset="photo-480.avif 480w,
          photo-800.avif 800w,
          photo-1280.avif 1280w"
  sizes="(width < 48rem) 100vw, 50vw"
  width="1280"
  height="853"
  alt="…">
```

`sizes` сообщает browser **ожидаемую rendered slot width**. Если она не совпадает с CSS layout, браузер может регулярно выбирать чрезмерно тяжелый candidate.

## 8.3 `width`/`height` нужны даже responsive image

Они дают браузеру aspect-ratio до загрузки ресурса и уменьшают CLS. CSS затем может спокойно делать `max-inline-size: 100%; block-size: auto`.

## 8.4 `<picture>` — для art direction, а не как обязательная обертка каждого image

```html
<picture>
  <source media="(width < 40rem)" srcset="portrait-crop.avif">
  <img src="wide.avif" alt="…" width="1200" height="675">
</picture>
```

## 8.5 Не lazy-load LCP/hero image

Для likely-LCP:

```html
<img
  src="hero.avif"
  width="1600"
  height="900"
  fetchpriority="high"
  alt="…">
```

`loading="lazy"` на LCP image откладывает discovery/load и ухудшает LCP. Lazy loading оставляйте для offscreen media.

---

# 9. Viewport: `vh` больше не единственная высота

Mobile browser chrome делает классический `100vh` неоднозначным.

## 9.1 Выбирайте unit по семантике

- `100svh` — гарантированно помещается при развернутых browser bars;
- `100lvh` — размер при скрытых bars;
- `100dvh` — следует за динамическим viewport.

Пример shell:

```css
.fullscreen-panel {
  min-block-size: 100svh;
}
```

Для interactive full-screen можно выбрать `dvh`, но его динамическое изменение может давать perceptible resize during scroll.

## 9.2 `100vw` тоже имеет edge case

Классические scrollbars могут не учитываться в viewport units, поэтому `width: 100vw` иногда создает лишний horizontal overflow. Для обычного full-width block чаще безопаснее `inline-size: 100%`.

## 9.3 Virtual keyboard — отдельный тест

Не предполагайте, что viewport units автоматически корректно решат форму с открытой on-screen keyboard. Проверяйте реальный mobile browser: focus, scroll into view, sticky footer, dialog positioning.

---

# 10. Input modality: не выводите touch/hover из ширины

Плохая логика:

```css
@media (max-width: 768px) {
  /* значит touch */
}
```

Правильнее спрашивать о capability:

```css
@media (hover: hover) and (pointer: fine) {
  .menu-item:hover .submenu { /* enhancement */ }
}

@media (pointer: coarse) {
  .icon-button {
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
  }
}
```

### Не делайте hover единственным способом открыть функциональность

Hybrid devices существуют; primary pointer может изменяться. Hover — enhancement, не обязательный interaction gate.

---

# 11. Accessibility — это responsive requirement, а не отдельный checklist

## 11.1 400% zoom — обязательный инженерный stress test

WCAG Reflow требует, чтобы контент при эквиваленте 320 CSS px ширины сохранял информацию/функциональность без двухмерного scroll, кроме действительно двумерных объектов (например, сложные таблицы/диаграммы).

Практический тест:

- desktop viewport около 1280 CSS px;
- zoom 400%;
- проверить reflow;
- никаких исчезнувших search/filter/actions;
- keyboard order остается логичным.

## 11.2 Нельзя «упрощать mobile» удалением capability

Допустимо:

- переместить функцию в overflow menu;
- свернуть secondary content;
- изменить sequence;
- заменить persistent panel на drawer.

Недопустимо без эквивалента:

- удалить search;
- убрать важные filters;
- скрыть labels и оставить только placeholders;
- убрать meaningful image/info.

## 11.3 Source order важнее визуального order

Grid/Flex позволяют переставить элементы визуально, но keyboard/screen reader order следует DOM.

Правило:

> Если visual order и semantic/task order расходятся настолько, что нужно много `order`/grid-placement magic, вероятно, HTML structure спроектирована неправильно.

## 11.4 Target size: точная формулировка

- **WCAG 2.2 AA SC 2.5.8:** 24×24 CSS px или достаточное spacing/исключение.
- **WCAG AAA SC 2.5.5:** 44×44 CSS px.

Для production touch UI 44–48 CSS px остается хорошим ergonomic target, но не следует ошибочно называть его minimum AA requirement.

---

# 12. AWD / dynamic serving: когда серверная адаптация действительно полезна

## 12.1 Не делайте UA sniffing первым инструментом

Parsing `User-Agent` хрупок и исторически является источником compatibility bugs. Если задача — layout, используйте CSS. Если задача — feature support, используйте feature detection (`@supports`, API detection).

## 12.2 Client Hints — не повод переносить layout на сервер

Client Hints могут быть полезны для resource selection, но у них есть:

- privacy model;
- cache-key/Vary complexity;
- не все hints доступны одинаково;
- дополнительные запросы/negotiation;
- риск cache fragmentation.

Server adaptation оправдана, когда можно измерить существенный выигрыш: например, не отдавать несколько megabytes visualization code на устройство/режим, где функция физически недоступна.

## 12.3 Dynamic serving требует content parity

Если mobile/desktop HTML различаются:

- важный content должен присутствовать в обеих версиях;
- structured data / metadata должны быть согласованы;
- search engine crawler должен получать эквивалентную информацию;
- response caching должен учитывать вариацию (`Vary`).

Google по-прежнему рекомендует responsive same-HTML pattern как наиболее простой для implementation/maintenance.

## 12.4 «Adaptive быстрее» — не универсальная истина

AWD **может** быть быстрее, если реально доставляет меньший payload. Но такой же результат часто достигается в RWD через:

- route/component code splitting;
- responsive images;
- conditional import по feature/intent;
- server components/SSR;
- lazy hydration;
- resource priorities;
- content visibility/virtualization.

Поэтому performance — аргумент за AWD только после измерения **конкретной resource graph**, а не по определению подхода.

---

# 13. Design workflow: что дизайнер должен передавать разработчику

## 13.1 Не рисуйте 6 статических screenshot-specs

Статический макет не описывает поведение **между** фреймами. Для сложного responsive UI важнее специфицировать constraints:

- min/max inline size;
- wrap rules;
- grow/shrink priority;
- which element yields first;
- content priority;
- Switch conditions;
- overflow behavior;
- image crop strategy;
- minimum tap area;
- height-constrained behavior.

## 13.2 Хорошая handoff-единица — behavior table

| Component state | Condition | Layout change | Content change | Interaction change |
|---|---|---|---|---|
| compact | container < 28rem | stack | none | actions → menu |
| regular | 28–48rem | media + text | none | inline actions |
| wide | >48rem | split | metadata expanded | hover enhancement |

Это лучше, чем `mobile.png`, `tablet.png`, `desktop.png`.

## 13.3 Проектируйте крайние состояния одновременно

Практичный workflow из UX community: сначала проверить **самое узкое и самое широкое** состояния, чтобы выявить priority/measure проблемы, затем заполнить промежуток behavior rules.

Но не останавливайтесь на двух мокапах: промежуточные widths должны тестироваться живым prototype/code, иначе именно между контрольными точками появляются layout bugs.

---

# 14. Navigation: switching model без потери возможностей

## 14.1 Burger не является обязательным mobile pattern

Порядок выбора:

1. Может ли primary nav уместиться как compact/priority+?
2. Можно ли оставить top tasks visible, secondary спрятать?
3. Нужен ли bottom/tab navigation для high-frequency actions?
4. Только затем — generic drawer/hamburger.

Главная проблема burger — не сам icon, а скрытие information scent и лишний interaction cost.

## 14.2 Для complex desktop apps не «мобилизируйте» wide UI

Пользователь на desktop часто выигрывает от:

- большей information density;
- persistent panels;
- visible shortcuts;
- keyboard/mouse optimizations.

Responsive не означает «растянуть mobile design на desktop». Это ошибка, хорошо заметная в user feedback: гигантские controls и пустое пространство могут ухудшить продуктивность на больших экранах.

## 14.3 Master-detail

Хороший hybrid pattern:

- narrow: list → route/detail;
- medium: overlay/detail drawer;
- wide: persistent split pane.

Это пример **одной функции с тремя interaction compositions**, а не трех сайтов.

---

# 15. Forms и data-heavy UI

## 15.1 Не делайте все form rows вертикальными «на mobile» по умолчанию

Сначала определите logical grouping:

- короткие связанные поля (дата, unit/value, min/max) иногда лучше сохранять рядом;
- labels должны оставаться labels;
- action bar может перейти из inline в sticky/stacked только при реальной нехватке места.

## 15.2 Tables

Worst practice: автоматически превращать любую таблицу в cards.

Выбор зависит от задачи:

- comparison требует двумерного контекста → local horizontal scroll / sticky columns;
- record browsing → cards/list может быть лучше;
- аналитика → allow zoom/pan or alternate summary, но не уничтожайте связи данных.

WCAG Reflow прямо допускает исключения для content, который по смыслу требует двух измерений.

## 15.3 Toolbars

Вместо одного breakpoint используйте **priority collapse**:

```text
wide:  [Save] [Export] [Duplicate] [Share] [Delete]
mid:   [Save] [Export] [Share] [...]
narrow:[Save] [...]
```

Порядок должен следовать task frequency/risk, а не случайному DOM order.

---

# 16. Performance best practices, специфичные для responsive systems

## 16.1 Responsive CSS не означает responsive bytes

Скрытый `display:none` тяжелый widget может уже быть загружен/инициализирован.

Проверяйте отдельно:

- network bytes;
- JS parse/compile;
- hydration cost;
- image candidates;
- font subsets;
- hidden carousels/video.

## 16.2 CSS media queries на `<link>` не гарантируют «не загружать stylesheet»

Несовпадающий media stylesheet может все равно загружаться, хотя с другим priority. Не используйте media attribute как единственный механизм bundle splitting.

## 16.3 Measure with RUM by layout state

Полезнее сегментировать не только `mobile/desktop`, а:

- viewport/container class;
- DPR;
- connection/save-data;
- interaction mode;
- route complexity.

Так видно, какой **layout state** реально страдает по LCP/INP/CLS.

---

# 17. Testing strategy: тестируйте пространство состояний, а не список устройств

## 17.1 Минимальная матрица

### Геометрия

- 320 CSS px;
- 360/390;
- 480–600;
- 768-ish;
- 1024-ish;
- 1280–1440;
- 1920+;
- очень низкая height;
- portrait/landscape;
- split-screen widths.

Числа здесь — **test samples**, не design breakpoints.

### Accessibility

- 200% text resize;
- 400% browser zoom;
- keyboard-only;
- visible focus;
- reduced motion / forced colors при релевантности.

### Input

- fine pointer + hover;
- coarse pointer;
- touch-enabled laptop;
- keyboard.

### Content

- longest translation;
- empty state;
- max-length validation errors;
- long filenames/URLs/IDs;
- 1 item / 100 items;
- slow/missing image.

## 17.2 Continuous-width sweep важнее device presets

Device presets полезны для известных browser quirks, но многие responsive bugs живут на случайных ширинах 713, 917 или 1138 px.

Полезный automated test:

```text
for width in 320..1600 step 40:
    render critical route
    assert no document-level horizontal overflow
    capture screenshot
```

Затем отдельно — точечные проверки вокруг каждого breakpoint `N-1 / N / N+1`.

## 17.3 Playwright

Playwright позволяет эмулировать viewport, screen, touch, DPR, locale и device presets. Для production-suite полезно иметь два класса тестов:

1. **behavioral**: навигация/controls сохраняют функции во всех layout states;
2. **visual**: screenshot regression на representative widths + breakpoint boundaries.

Не путайте device emulation с реальным hardware testing: address bars, keyboards, safe areas, font rendering и power/performance характеристики полностью не эмулируются.

---

# 18. Worst practices — короткий blacklist

## 18.1 Device breakpoints как догма

`375 / 768 / 1024 / 1440` можно использовать как test samples, но не как обоснование architecture.

## 18.2 JavaScript resize listeners для того, что умеет CSS

Если задача выражается media/container query, JS добавляет race conditions, hydration mismatch и maintenance cost.

## 18.3 UA sniffing для layout

`Android = mobile`, `iPad = tablet`, `Safari = touch` — неверные модели.

## 18.4 Дублирование DOM только ради разных positions

Две копии одной control group (`desktop-only` и `mobile-only`) создают:

- duplicate IDs;
- accessibility confusion;
- divergent state;
- двойную event logic;
- analytics duplication.

Перестройте layout или component composition; duplication оставляйте для исключительных случаев.

## 18.5 `position: absolute` как основной responsive layout engine

Absolute positioning годится для overlays/decoration, но layout должен в основном строиться flow/Grid/Flex.

## 18.6 Fixed heights для dynamic content

Один из самых надежных способов сломать localization и zoom.

## 18.7 Скрывать content вместо переосмысления hierarchy

`display:none` не является responsive strategy. Скрывайте только действительно secondary/redundant information и сохраняйте эквивалентный путь к функции.

## 18.8 «На мобильном меньше функций» как автоматическое правило

Capability parity важнее visual parity.

## 18.9 Масштабировать desktop screenshot вниз

Proportional shrink сохраняет desktop information architecture в неподходящей geometry и часто производит микротекст/микроконтролы.

## 18.10 Делать все крупнее на wide screen

Wide screen чаще требует **лучшего использования пространства**, а не 1.5× кнопок и текста: max-width, columns, auxiliary context, controlled whitespace, higher information density.

---

# 19. Практический reference architecture

```css
/* 1. Global page constraint */
.page-frame {
  inline-size: min(100% - 2 * clamp(1rem, 3vw, 3rem), 90rem);
  margin-inline: auto;
}

/* 2. Intrinsic macro grid */
.dashboard {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: clamp(1rem, 0.5rem + 1vw, 2rem);
}

/* 3. Component containment */
.widget-region {
  container: widget / inline-size;
}

.widget {
  display: grid;
  gap: 1rem;
  min-inline-size: 0;
}

@container widget (width > 32rem) {
  .widget {
    grid-template-columns: minmax(8rem, 0.8fr) minmax(0, 2fr);
  }
}

/* 4. Interaction capability */
@media (hover: hover) and (pointer: fine) {
  .widget-action:hover {
    /* enhancement only */
  }
}

/* 5. Short viewport */
@media (height < 32rem) {
  .sticky-header {
    position: static;
  }
}

/* 6. Defensive text */
.widget,
.prose {
  overflow-wrap: anywhere;
}

.prose {
  max-inline-size: 68ch;
}
```

Идея примера: **сначала intrinsic behavior, затем local container adaptation, потом редкие viewport switches и capability queries**.

---

# 20. Revised Stretch → Scale → Switch

Подход SSS из SimpleOne полезен как mental model, но для production его стоит уточнить.

## Stretch

**Оставить как основной этап.**

Инструменты:

- Grid/Flex;
- `%`, `fr`, intrinsic sizing;
- `minmax()`;
- `auto-fit`;
- max-inline-size;
- natural wrapping.

## Scale

**Заменить global proportional scaling на bounded scaling.**

Использовать:

- `clamp()`;
- fluid space/type tokens;
- `cqi` для component-relative scaling;
- max widths / readable measure.

Не использовать как универсальный множитель для всего UI.

## Switch

**Разделить на macro и micro.**

- macro switch → `@media`;
- component switch → `@container`;
- input switch → `hover`/`pointer` queries;
- feature switch → `@supports`;
- server switch → только при реальной delivery/function difference.

Итоговая модель:

> **Flow → Constrain → Scale within bounds → Switch only on failure → Enhance by capability.**

---

# 21. Decision checklist перед добавлением breakpoint

Перед каждым новым breakpoint ответьте:

1. Можно ли устранить проблему normal flow/Grid/Flex?
2. Можно ли использовать `minmax()`, wrapping, intrinsic size?
3. Проблема относится к viewport или к размеру конкретного компонента?
4. Не является ли проблема длинным content/string overflow?
5. Не создаст ли новый breakpoint еще один state для QA?
6. Можно ли выразить изменение через continuous `clamp()` вместо jump?
7. Сохраняется ли semantic/source order?
8. Сохраняется ли функция при 400% zoom?
9. Сработает ли решение при touch laptop и narrow desktop window?
10. Есть ли реальное измерение, которое оправдывает server-side variant?

Если на первые 4 вопроса ответ «да», breakpoint часто не нужен.

---

# 22. FAQ

## Q1. Mobile-first всегда лучше desktop-first?

**Нет.** Mobile-first как CSS strategy удобен, потому что базовый слой обычно проще и `min-width` enhancements легче поддерживать. Но product design может начинаться с наиболее важного user context. Главное — не направление рисования макетов, а отсутствие предположения, что desktop можно просто пропорционально уменьшить.

## Q2. Сколько breakpoints должно быть?

Столько, сколько **необходимо для failure points**, и не больше. На page shell их часто 2–4; на component level container queries могут иметь собственные 1–2 thresholds. Универсального набора нет.

## Q3. Нужен ли breakpoint для каждого Figma frame?

Нет. Frame — sample state. Breakpoint нужен только если между состояниями есть дискретное изменение behavior/composition.

## Q4. Media queries устарели из-за container queries?

Нет. Они решают разные уровни. Media queries — environment/page; container queries — component context.

## Q5. Можно ли вообще сделать responsive UI без media queries?

Для многих grids/cards — да, благодаря Grid/Flex/intrinsic sizing. Но complex navigation и application shell обычно все равно имеют несколько meaningful switches.

## Q6. `px` нельзя использовать в responsive design?

Неверно. CSS px нормален для borders, icons, minimum hit geometry и многих точных размеров. Ошибка — фиксировать им layout, который должен зависеть от доступного пространства или user font settings.

## Q7. `rem` лучше `em`?

Не «лучше», а проще предсказуем. `rem` удобен для global scale; `em` полезен, когда component spacing должен масштабироваться вместе с локальным font-size.

## Q8. Нужно ли использовать `vw` для fluid typography?

Можно как часть `clamp()`, но лучше bounded formula. Для reusable components часто логичнее `cqi`.

## Q9. Что использовать вместо `100vh`?

Выбирать по семантике: `svh`, `lvh`, `dvh`. Для «должно всегда помещаться» часто `svh`; для динамического fullscreen — `dvh` с тестированием scroll behavior.

## Q10. Нужно ли делать отдельную tablet version?

Не как самоцель. Tablet — не уникальный constraint. Добавляйте состояние, если конкретный UI требует отдельной composition на промежуточном диапазоне.

## Q11. AWD быстрее RWD?

Не по определению. AWD может отдать меньше bytes, но RWD тоже может иметь excellent resource selection/code splitting. Сравнивайте конкретные waterfalls и RUM.

## Q12. Server-side device detection — современный подход?

Иногда, но не default. Layout лучше решать CSS; UA sniffing хрупок. Client Hints могут помочь resource selection, но добавляют cache/privacy complexity.

## Q13. Нужен ли отдельный `m.` site?

Для нового проекта почти никогда. Отдельные URLs увеличивают SEO, analytics, content parity и maintenance complexity.

## Q14. Можно ли скрывать secondary content на narrow layout?

Да, если информация действительно вторична или доступна через disclosure. Нельзя терять core functionality/information.

## Q15. Как тестировать breakpoints?

Не только exact width. Тестируйте `breakpoint - 1`, `breakpoint`, `breakpoint + 1`, плюс continuous sweep между ними.

## Q16. Какая минимальная touch target size?

WCAG 2.2 AA: 24×24 CSS px или spacing exception. Для practical touch UX обычно целиться в 44–48 CSS px разумнее.

## Q17. Что делать с очень широкими 4K/ultrawide screens?

Не растягивать все. Ограничить reading measure/page frame; использовать extra space для auxiliary information, multi-pane, whitespace или richer context. Wide screen — отдельная возможность, а не команда «scale ×1.5».

## Q18. Что важнее: одинаковый внешний вид или одинаковые возможности?

**Возможности и смысл.** Layout может радикально различаться; core task path не должен исчезать.

## Q19. Можно ли менять DOM order через CSS?

Визуально — да, но осторожно: keyboard/screen-reader order останется source-based. Для major semantic reorder лучше менять composition/markup architecture, а не только CSS placement.

## Q20. Какие responsive bugs чаще всего пропускают senior-команды?

- min-content overflow в Grid/Flex;
- long localized labels;
- 400% zoom;
- low-height landscape;
- touch laptop;
- `100vh`/keyboard/browser chrome;
- hidden-but-still-loaded assets;
- incorrect `sizes` у `srcset`;
- visual order ≠ focus order;
- layout между «красивыми» Figma breakpoints.

---

# 23. Оценка предоставленных источников

## 1. SimpleOne / Habr — Stretch, Scale, Switch

**Полезно:** ясная трехфазная модель и идея не делать бесконечные layouts.  
**Уточнение:** literal global Scale лучше заменить bounded fluid tokens; modern container queries позволяют делать Switch локально, а не только на уровне viewport.

## 2. Kokoc — гайд по адаптивной верстке

**Полезно:** обновленные упоминания container queries, `clamp()`, responsive images, `dvh`, mobile-first.  
**Использовать критически:** часть формулировок чрезмерно универсализирует relative units и target sizes; sample breakpoints — только ориентиры.

## 3. Coursera/GitHub — Basic Concepts

**Полезно:** фундаментальное различие fluid responsive vs multiple adaptive layouts и важный принцип: mobile может иметь другой layout, но не должен терять capabilities.  
**Ограничение:** учебный материал базового уровня и не отражает modern container/intrinsic CSS.

## 4. Reddit / r/UXDesign

**Полезно как practitioner evidence:** проектировать extreme widths, не называть layouts по устройствам, выбирать content breakpoints, тратить время не на 5 статических макетов, а на testing.  
**Статус:** community advice, не normative source.

## 5. Medium / Responsive Web Design Principles

**Полезно:** компактное повторение fluid layout, fixed-height risks, real-device testing.  
**Уточнение:** 48×48 — хороший UX target, но не WCAG 2.2 AA minimum.

## 6. WhiteLabelIQ — Responsive vs Adaptive

**Полезно:** хороший business/maintenance взгляд: QA bandwidth, long-term cost, known-device scenarios.  
**Уточнение:** тезис «adaptive faster» верен только при реально меньшем payload; архитектурно это не гарантируется.

## 7. Beget / Habr — responsive web applications

**Полезно:** мысль не привязывать layout names к device assumptions; отдельное внимание low-height viewport и testing.  
**Уточнение:** magic breakpoint tables — starting samples, не design truth.

## 8. Medium / Aida Pacheva

Страница ограниченно доступна для автоматического чтения; поэтому она включена в bibliography как предоставленный ресурс, но технические утверждения из нее не использованы как опорные без независимого подтверждения.

## 9. Yandex Practicum

**Полезно:** правильная формулировка, что универсальных breakpoints нет и точки выбираются там, где layout перестает быть удобным.  
**Критика:** совет «перенести desktop элементы и пропорционально уменьшить» слишком упрощает modern responsive work и конфликтует с content/interaction-first подходом.

## 10. RUVDS / Habr — UI rules

Не RWD-специфичный материал, но полезен для responsive accessibility: contrast, typography, visual indicators. Использован как secondary UI reference.

## 11. MDN Responsive Design

Сильный primary technical reference. Использован вместе с более узкими MDN страницами по container queries, media capabilities, intrinsic sizing и UA sniffing.

---

# 24. Продвинутый reading list

Ниже — ресурсы, которые дают больше практической ценности senior-разработчику, чем типичные «5 responsive tips».

### Основы и эволюция подхода

1. **Ethan Marcotte — Responsive Web Design, A List Apart**  
   https://alistapart.com/article/responsive-web-design/

2. **Jen Simmons — Intrinsic Web Design / experiments**  
   https://labs.jensimmons.com/  
   https://talks.jensimmons.com/jugbbe/everything-you-know-about-web-design-just-changed

3. **web.dev — The New Responsive: Web Design in a Component-Driven World**  
   https://web.dev/articles/new-responsive

### Container / intrinsic layout

4. **MDN — CSS Container Queries**  
   https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries

5. **MDN — Using container size and style queries**  
   https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries

6. **web.dev — Container Queries**  
   https://web.dev/learn/css/container-queries/

7. **Modern CSS — Container Query Units and Fluid Typography**  
   https://moderncss.dev/container-query-units-and-fluid-typography/

8. **web.dev — CSS Grid, auto-fit / minmax intrinsic pattern**  
   https://web.dev/learn/css/grid

### Viewport / media capabilities

9. **web.dev — Large, Small and Dynamic Viewport Units**  
   https://web.dev/blog/viewport-units

10. **MDN — `hover` media feature**  
    https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover

11. **MDN — `pointer` media feature**  
    https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer

12. **web.dev — Media Query Range Syntax**  
    https://web.dev/articles/media-query-range-syntax

### Accessibility / reflow

13. **W3C/WAI — WCAG 2.2 Reflow 1.4.10**  
    https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

14. **W3C/WAI — Target Size (Minimum) 2.5.8**  
    https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

15. **web.dev — Accessible Responsive Design**  
    https://web.dev/articles/accessible-responsive-design

16. **W3C/WAI — Visual Presentation / line measure**  
    https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html

### Images / performance

17. **web.dev — Serve Responsive Images**  
    https://web.dev/articles/serve-responsive-images

18. **web.dev — Optimize LCP**  
    https://web.dev/articles/optimize-lcp

19. **web.dev — Preload Responsive Images**  
    https://web.dev/articles/preload-responsive-images

### Server-side adaptive delivery

20. **Google Search Central — Mobile-first / responsive vs dynamic serving vs separate URLs**  
    https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing

21. **MDN — Browser detection / UA sniffing pitfalls**  
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent

22. **MDN — HTTP Client Hints**  
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Client_hints

### Testing

23. **Playwright — Emulation**  
    https://playwright.dev/docs/emulation

---

# 25. Предоставленные пользователем источники

1. https://habr.com/ru/companies/simpleone/articles/881168/
2. https://kokoc.com/blog/chto-takoe-adaptivnaya-vyorstka-sajta-primery/
3. https://github.com/santhosh-programmer/Web-Design-for-Everybody-Coursera/blob/main/Advanced-Styling-with-Responsive-Design/week-1/Basic_Concepts_in_Responsive_Design_approaches.md
4. https://www.reddit.com/r/UXDesign/comments/oge9rm/how_best_to_create_responsive_designs/
5. https://medium.com/@ignatovich.dm/responsive-web-design-principles-and-best-practices-5370d8ce1c1d
6. https://www.whitelabeliq.com/blog/should-you-go-responsive-or-adaptive-heres-what-agencies-actually-need/
7. https://habr.com/ru/companies/beget/articles/899732/
8. https://medium.com/@aidapacheva/%D0%BD%D0%BE%D0%B2%D1%8B%D0%B9-%D0%BF%D0%BE%D0%B4%D1%85%D0%BE%D0%B4-%D0%B2-%D0%B4%D0%B8%D0%B7%D0%B0%D0%B9%D0%BD%D0%B5-%D0%B0%D0%B4%D0%B0%D0%BF%D1%82%D0%B8%D0%B2%D0%BD%D0%BE%D1%81%D0%B8-%D0%B2%D0%B5%D0%B1-%D1%81%D0%B0%D0%B9%D1%82%D0%BE%D0%B2-c8532d409c80
9. https://practicum.yandex.ru/blog/kak-adaptirovat-sayt-pod-mobilnye-ustroystva/
10. https://habr.com/ru/companies/ruvds/articles/732942/
11. https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design

---

# 26. Финальная практическая формула

Для нового проекта в 2026 году:

```text
semantic HTML
  ↓
normal flow + intrinsic sizing
  ↓
Grid/Flex + minmax/auto-fit
  ↓
bounded fluid tokens (clamp)
  ↓
container queries for reusable components
  ↓
small number of viewport queries for page topology
  ↓
capability queries for pointer/hover/preferences
  ↓
responsive resource selection (srcset/sizes/picture)
  ↓
400% zoom + content/localization + continuous-width testing
  ↓
server-side adaptive delivery only if measured benefit justifies complexity
```

**RWD — базовая геометрическая стратегия. AWD — точечный инструмент для дискретной композиции или доставки. Лучшие production-системы используют оба, но на разных уровнях и по разным причинам.**
