# BioMD 1.3 — конформность

*Проверочная страница для расширений формата: `::: align`, `frame:`, `::: nav`*

::: nav
title: Разделы демонстрации
active: Выравнивание

- [Выравнивание](biomd-demo.bio.md)
- [Рамки](agustin-barrios.bio.md)
- [Меню](jovan-jovicic.bio.md)
- [Внешняя ссылка](https://www.abc-guitars.com)
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
position: left

**Слева** — значение по умолчанию, указанное явно.

:::

::: align

Блок без `position`: предупреждение в консоли, текст сохранён и выровнен по
умолчанию.

:::

::: align
position: middle

Неизвестное значение `position`: тоже предупреждение и обычное выравнивание.

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
caption: frame: curl
frame: curl
:::

::: image
src: photo/b/barrios1.jpg
caption: frame: none
frame: none
:::

:::

::: images
columns: 3

::: image
src: photo/b/barrios2.jpg
caption: frame: white
frame: white
:::

::: image
src: photo/b/barrios1.jpg
caption: frame: red
frame: red
:::

::: image
src: photo/b/barrios2.jpg
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

::: image
src: photo/b/barrios.jpg
position: center
size: medium
caption: неизвестное значение frame → рамка по умолчанию
frame: neon
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
src: photo/b/barrios2.jpg
position: left
size: small
alt: Обложка со ссылкой на внешний сайт
caption: link → внешний сайт
link: https://www.abc-guitars.com
:::

::: image
src: photo/b/barrios.jpg
position: left
size: small
caption: небезопасная схема link отбрасывается
link: javascript:alert(1)
:::

## 4. Меню без заголовка

::: nav

- [Агустин Барриос](agustin-barrios.bio.md)
- [Андрес Сеговия](andres-segovia.bio.md)
- [Джанго Рейнхардт](django-reinhardt.bio.md)
- [Пако де Лусия](paco-de-lucia.bio.md)
- [Джими Хендрикс](jimi-hendrix.bio.md)
- [Йован Йовичич](jovan-jovicic.bio.md)
- [Авторы проекта](authors.bio.md)
- [Табулатура вместо страницы](music/tab/abmcueca.txt)
:::

test test test
::: columns

::: column

Столбцы, изображения и списки продолжают работать без изменений.

- первый пункт
- второй пункт

:::

::: column

Любой дрогой текст, бла-бла-бла

- третий пункт
- четвертый пункт

:::

:::



## 5. Старая разметка рядом с новой

::: columns

::: column

Столбцы, изображения и списки продолжают работать без изменений.

- первый пункт
- второй пункт

:::

::: column

::: image
src: photo/b/barrios.jpg
position: center
size: medium
caption: изображение внутри столбца
:::

:::

:::

::: unknownblock

Неизвестный блок по-прежнему сохраняет содержимое.

:::
