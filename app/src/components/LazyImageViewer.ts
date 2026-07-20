import { lazy } from "react";

const importImageViewer = () =>
  import("./ImageViewer").then(({ ImageViewer }) => ({ default: ImageViewer }));

let pending: ReturnType<typeof importImageViewer> | undefined;
const loadImageViewer = () => (pending ??= importImageViewer());

export const LazyImageViewer = lazy(loadImageViewer);
export const preloadImageViewer = () => void loadImageViewer();
