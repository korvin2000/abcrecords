import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { LazyAsciiTabViewer, preloadAsciiTabViewer } from "@/components/LazyAsciiTabViewer";
import { useLinger, useReducedMotion } from "./motion";

export interface ViewerTab {
  readonly src: string;
  readonly label?: string;
  readonly download?: string;
}

type OpenTab = (tab: ViewerTab) => void;
const AsciiTabViewerContext = createContext<OpenTab>(() => {});

/** Open one application-wide, lazily loaded ASCII-tab modal. */
export function useAsciiTabViewer(): OpenTab {
  return useContext(AsciiTabViewerContext);
}

export function AsciiTabViewerProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<ViewerTab | null>(null);
  const open = useCallback<OpenTab>((next) => {
    preloadAsciiTabViewer();
    setTab(next);
  }, []);
  const close = useCallback(() => setTab(null), []);
  // Held on screen for the length of the viewer's CSS fade-out.
  const shown = useLinger(tab, useReducedMotion() ? 0 : 200);

  return (
    <AsciiTabViewerContext.Provider value={open}>
      {children}
      <Suspense fallback={null}>
        {shown.value && (
          <LazyAsciiTabViewer key={shown.value.src} tab={shown.value} leaving={shown.leaving} onClose={close} />
        )}
      </Suspense>
    </AsciiTabViewerContext.Provider>
  );
}
