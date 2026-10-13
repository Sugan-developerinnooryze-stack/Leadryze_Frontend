import { useEffect } from 'react';
import { useOverlayVisibilityStore } from '../stores/overlayVisibility.store';

/** Call unconditionally from the body of any component that only ever
 * mounts while it's "open" (a drawer, a centered modal) — its own
 * mount/unmount IS the open/close signal, registered with
 * overlayVisibility.store.ts so ChatWidget can hide its floating button
 * for as long as anything like this is on screen. */
export function useRegisterOverlayOpen(): void {
  const { push, pop } = useOverlayVisibilityStore();
  useEffect(() => {
    push();
    return () => pop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
