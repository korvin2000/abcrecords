import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { LazyImageViewer, preloadImageViewer } from "@/components/LazyImageViewer";

/**
 * App-wide image viewer. A single overlay is held here and opened from anywhere
 * via `useImageViewer()`, so every image link, figure, gallery photo and image
 * document shares one consistent viewer (lazily loaded on first use).
 */

export interface ViewerImage {
  src: string;
  alt?: string;
  caption?: string;
  /** Suggested download filename; defaults to the URL's basename. */
  download?: string;
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|apng|ico)$/i;

/** True when the URL points at a viewable image file (query/hash ignored). */
export function isImageUrl(url: string): boolean {
  return IMAGE_RE.test(url.split(/[?#]/, 1)[0]);
}

type OpenImage = (image: ViewerImage) => void;
const ImageViewerContext = createContext<OpenImage>(() => {});

/** `const open = useImageViewer(); open({ src, caption })`. */
export function useImageViewer(): OpenImage {
  return useContext(ImageViewerContext);
}

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<ViewerImage | null>(null);
  const open = useCallback<OpenImage>((img) => {
    preloadImageViewer();
    setImage(img);
  }, []);
  const close = useCallback(() => setImage(null), []);

  return (
    <ImageViewerContext.Provider value={open}>
      {children}
      <Suspense fallback={null}>
        <AnimatePresence>
          {image && <LazyImageViewer key={image.src} image={image} onClose={close} />}
        </AnimatePresence>
      </Suspense>
    </ImageViewerContext.Provider>
  );
}
