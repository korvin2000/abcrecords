import { lazy } from "react";

const importAsciiTabViewer = () =>
  import("./AsciiTabViewer").then(({ AsciiTabViewer }) => ({ default: AsciiTabViewer }));

let pending: ReturnType<typeof importAsciiTabViewer> | undefined;
const loadAsciiTabViewer = () => (pending ??= importAsciiTabViewer());

export const LazyAsciiTabViewer = lazy(loadAsciiTabViewer);
export const preloadAsciiTabViewer = () => void loadAsciiTabViewer();
