/// <reference types="vite/client" />

/*
 * Einziger Zugang zum Stylesheet des Packages.
 *
 * Der Verweis auf `vite/client` steht hier und nicht in einer eigenen
 * `.d.ts`-Datei: eine eigene `declare module '*.module.css'` wuerde sich mit der
 * gleichlautenden Deklaration aus `vite/client` in der Host-Anwendung beissen.
 * Ein Triple-Slash-Verweis auf dasselbe Typpaket ist dagegen unproblematisch —
 * TypeScript laedt es genau einmal. Die Host-Anwendung braucht dafuer nichts zu
 * tun; sie muss lediglich, wie in docs/react-modular-architecture.md
 * vorausgesetzt, ein Vite-Projekt sein.
 *
 * Der Import laeuft ueber das async-Chunk des Packages: Vite trennt das CSS
 * beim Bauen mit ab (`build.cssCodeSplit`, Standard) und laedt es erst, wenn
 * das Guestbook per dynamischem Import angefordert wird.
 */
import classes from './guestbook.module.css';

const styles: Readonly<Record<string, string>> = classes;

export default styles;

/**
 * Klassennamen zusammensetzen. Nimmt `false`/`undefined` entgegen, damit
 * bedingte Modifier ohne Ternaer-Kaskade geschrieben werden koennen:
 *
 *     cx(styles.entry, isSticky && styles.entrySticky)
 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}
