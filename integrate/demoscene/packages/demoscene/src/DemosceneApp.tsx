import { useEffect, useRef } from 'react';
import type { DemosceneProps } from './types';
import { Dialog } from './ui/Dialog';

/**
 * The demoscene, as one controlled React component. This is the whole public
 * React surface of `@site/demoscene`.
 *
 * It renders `null`. The production lives in its own shadow root appended to
 * `document.body` (see the package README on why Shadow DOM here, rather than
 * the CSS-Modules default of architecture guide §20), so it costs nothing in
 * the host's tree, cannot be reached by host CSS, and cannot leak its own.
 *
 * ```tsx
 * const Demoscene = lazy(() => import('@site/demoscene'));
 *
 * function AboutButton({ locale }: { locale: string }) {
 *   const [open, setOpen] = useState(false);
 *   return (
 *     <>
 *       <button onClick={() => setOpen(true)}>About</button>
 *       {open && (
 *         <Suspense fallback={null}>
 *           <Demoscene open locale={locale} onClose={() => setOpen(false)} />
 *         </Suspense>
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * Side-effect ownership (architecture guide §23): unmounting this component
 * stops the render loop, closes the `AudioContext`, clears the row timer,
 * removes every window/document listener, disconnects the ResizeObserver,
 * restores `document.body.style.overflow` and removes the shadow host. There
 * is nothing for the host to clean up.
 */
export function DemosceneApp(props: DemosceneProps): null {
  const { open, onClose, onOpen, ...options } = props;
  const ref = useRef<Dialog | null>(null);
  /* keep the latest callbacks without re-creating the dialog */
  const cbs = useRef({ onClose, onOpen });
  cbs.current = { onClose, onOpen };

  const {
    locale,
    fallbackLocale,
    autoMusic,
    volume,
    maxDpr,
    content,
    messages,
  } = options;

  useEffect(() => {
    const d = new Dialog({
      content,
      messages,
      locale,
      fallbackLocale,
      autoMusic,
      volume,
      maxDpr,
      onClose: () => cbs.current.onClose?.(),
      onOpen: () => cbs.current.onOpen?.(),
    });
    ref.current = d;
    return () => {
      ref.current = null;
      d.destroy();
    };
    /* content/messages are objects; callers should memoise or accept a rebuild */
  }, [content, messages, locale, fallbackLocale, autoMusic, volume, maxDpr]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    /* silent on both sides: the parent owns `open`, so echoing the change
       back through onOpen/onClose would be a feedback loop */
    if (open) d.open(true);
    else d.close(true);
  }, [open]);

  return null;
}

export default DemosceneApp;
