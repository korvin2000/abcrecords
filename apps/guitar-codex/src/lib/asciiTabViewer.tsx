import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { LazyAsciiTabViewer, preloadAsciiTabViewer } from "@/components/LazyAsciiTabViewer";

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

  return (
    <AsciiTabViewerContext.Provider value={open}>
      {children}
      <Suspense fallback={null}>
        <AnimatePresence>
          {tab && <LazyAsciiTabViewer key={tab.src} tab={tab} onClose={close} />}
        </AnimatePresence>
      </Suspense>
    </AsciiTabViewerContext.Provider>
  );
}
