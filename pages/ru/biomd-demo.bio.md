# BioMD 1.5 — конформность

*Проверочная страница расширений формата: `::: frame`, `::: signature`, `columns: N`, `divider`, нумерация `01.`, восстановление после ошибок*

::: nav
title: Разделы демонстрации

- Конформность 1.5
- [Барриос](agustin-barrios.bio.md)
- [Йовичич](jovan-jovicic.bio.md)
- [Внешняя ссылка](https://www.abc-guitars.com)
- [Табулатура остаётся ссылкой](tabs/jsb1006p.tab.txt)
:::

::: lead

Страница существует только для проверки того, что новые блоки отображаются
правильно и не задевают старую разметку.

:::

## 1. Выравнивание

::: align
position: center

**Программа концерта** · Bach · Sor · Tárrega

:::

::: align
position: right

*Харьков, 12 мая 1998 года*

:::

::: align
position: middle

Неизвестное значение `position`: предупреждение в консоли, текст сохранён и
выровнен по умолчанию.

:::

## 2. Рамки изображений

::: image
src: photo/b/barrios.jpg
position: right
size: small
alt: Агустин Барриос с гитарой
caption: frame: black
frame: black
:::

Текст обтекает портрет в рамке точно так же, как и раньше. Ниже — по одному
изображению на каждое значение `frame`, включая значение по умолчанию.

::: images
columns: 3

::: image
src: photo/b/barrios1.jpg
caption: без frame (по умолчанию)
:::

::: image
src: photo/b/barrios2.jpg
caption: frame: none
frame: none
:::

::: image
src: photo/b/barrios1.jpg
caption: frame: gold
frame: gold
:::

:::

Групповая рамка `mat` наследуется всеми дочерними изображениями, кроме тех,
которые задают собственное значение.

::: images
columns: 2
frame: mat

::: image
src: photo/b/barrios1.jpg
caption: mat (наследуется)
:::

::: image
src: photo/b/barrios2.jpg
caption: red (переопределено)
frame: red
:::

:::

## 3. Ссылки на изображениях

::: image
src: photo/b/barrios1.jpg
position: left
size: small
alt: Обложка с ссылкой на другую страницу каталога
caption: link → другая статья
link: agustin-barrios.bio.md
frame: black
:::

::: image
src: photo/b/barrios.jpg
position: left
size: small
caption: небезопасная схема link отбрасывается
link: javascript:alert(1)
:::

## 4. Колонки

Старая запись без `columns:` — число дорожек равно числу блоков `::: column`.

::: columns
divider: true

::: column

Столбцы, изображения и списки продолжают работать без изменений.

- первый пункт
- второй пункт

:::

::: column

::: image
src: photo/b/barrios2.jpg
position: center
size: medium
caption: изображение внутри столбца
:::

:::

:::

Новая запись: `columns: 2` задаёт две дорожки, а записей в блоке сколько угодно —
они заполняют сетку построчно. Один блок вместо пяти.

::: columns
columns: 2
divider: true

::: column
**La Catedral**
:::

::: column
1921
:::

::: column
**Julia Florida**
:::

::: column
1938
:::

::: column
**Las Abejas**
:::

::: column
1921
:::

::: column
**Vals № 3**
:::

::: column
1923
:::

:::

Три дорожки без разделителя; последняя строка остаётся неполной.

::: columns
columns: 3

::: column
Прелюдия
:::

::: column
Сарабанда
:::

::: column
Жига
:::

::: column
Бурре
:::

:::

## 5. Нумерация с ведущим нулём

01. Preludio
02. Andantino
03. Allegretto
04. Vals
05. Estudio
06. Mazurka
07. Barcarola
08. Cueca
09. Choro
10. Final

Обычный нумерованный список рядом, для сравнения:

1. Preludio
2. Andantino

## 6. Рамка-врезка (`::: frame`)

::: frame
frame: black

**14 августа 2020 года** в возрасте 87 лет скончался выдающийся британский
гитарист и лютнист

**Джулиан БРИМ**

::: image
src: photo/b/barrios.jpg
position: center
size: small
caption: Джулиан Брим (1933–2020)
frame: black
:::

:::

::: frame
frame: red

## ПОЗДРАВЛЯЕМ

**[Агустина Барриоса](agustin-barrios.bio.md)**\
*(Асунсьон)*

с присуждением звания почётного члена общества

:::

::: frame
frame: gold
title: Торжественное объявление

Церемониальная рамка: двойная золотая линия. Внутри разрешён блок
`::: align` — и он работает:

::: align
position: center

*Посвящается памяти Андреса Сеговии*

:::

:::

::: frame

Без свойства `frame` действует значение по умолчанию — `gold`.

:::

::: frame
frame: white

Рамка `white`: приподнятая карточка цвета бумаги для любой другой
осмысленной границы источника.

:::

## 7. Подпись (`::: signature`)

::: signature

*Авторы проекта «Гитаристы и композиторы»*\
*Виктор и Сергей Тавровские*\
*Кишинёв — Киев — Харьков*

:::

## 8. Документы

::: document
src: tabs/jsb1006p.tab.txt
title: Партита BWV 1006 — табулатура
mode: link
:::

Для `mode: embed` в корпусе пока нет ни одного PDF: блок покажет встроенный
просмотр там, где браузер его поддерживает, и всегда сохранит карточку-ссылку
как запасной вариант.

## 9. Восстановление после ошибок

Всё ниже содержит намеренные ошибки: содержимое обязано сохраниться, а в
консоли должны появиться предупреждения.

::: align
position: center

`::: columns` внутри `::: align` запрещён — колонки разворачиваются в обычный
поток:

::: columns

::: column
левая колонка
:::

::: column
правая колонка
:::

:::

:::

::: frame
frame: red

Вложенная рамка запрещена — её содержимое остаётся здесь:

::: frame
frame: black

текст внутренней рамки

:::

Меню внутри рамки тоже запрещено — остаётся обычным списком ссылок:

::: nav

- [Барриос](agustin-barrios.bio.md)
- [Йовичич](jovan-jovicic.bio.md)
:::

:::

::: image
src: photo/b/barrios2.jpg
position: center
size: small
postion: опечатка в имени свойства — предупреждение, свойство игнорируется
caption: неизвестное свойство и неизвестное значение frame
frame: neon
:::

::: unknownblock

Неизвестный блок по-прежнему сохраняет содержимое.

:::
