import { lazy } from "react";

const importCodexModal = () =>
  import("./CodexModal").then(({ CodexModal }) => ({ default: CodexModal }));

let pending: ReturnType<typeof importCodexModal> | undefined;
const loadCodexModal = () => (pending ??= importCodexModal());

export const LazyCodexModal = lazy(loadCodexModal);
export const preloadCodexModal = () => void loadCodexModal();
