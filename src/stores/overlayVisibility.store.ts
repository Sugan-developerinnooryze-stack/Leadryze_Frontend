import { create } from 'zustand';

/** Tracks how many full-screen overlays (a drawer, a centered modal) are
 * currently mounted anywhere in the app — a counter, not a boolean, since
 * more than one can legitimately be open at once (e.g. the automation
 * builder's node drawer stays open behind its own "Test this step" Dry Run
 * modal). Exists so ChatWidget's floating button — a `position: fixed`
 * element rendered as a sibling of the page content in Layout.tsx — can
 * hide itself while something that should visually own the screen is open.
 *
 * Why this exists instead of a CSS z-index fix: confirmed live (automation
 * builder's node drawer, Oct 2026) that the drawer's own z-index already
 * wins for pointer events — a click where the button visually peeks
 * through actually lands on the drawer underneath, not the button — but
 * the button still paints on top of the drawer's content in some browsers
 * due to how a `transform`-animated element (the drawer's slide-in
 * transition) interacts with a `position: fixed` sibling's own compositing
 * layer. That's a real but purely cosmetic stacking quirk, not a z-index
 * mistake to raise further; explicitly hiding the widget while a
 * known-full-screen overlay is open is the robust fix, not another z-index
 * number. */
interface OverlayVisibilityState {
  openCount: number;
  push: () => void;
  pop: () => void;
}

export const useOverlayVisibilityStore = create<OverlayVisibilityState>((set) => ({
  openCount: 0,
  push: () => set((s) => ({ openCount: s.openCount + 1 })),
  pop: () => set((s) => ({ openCount: Math.max(0, s.openCount - 1) })),
}));
