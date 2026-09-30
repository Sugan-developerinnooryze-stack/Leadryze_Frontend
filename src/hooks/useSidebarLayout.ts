import { useCallback, useRef } from 'react';
import { useAuthStore, type SidebarLayout } from '../stores/auth.store';
import { authService } from '../services/auth.service';

const DEBOUNCE_MS = 600;

/** A small, curated starting set — everything else begins unpinned (only
 * reachable via the More flyout) until the user pins it themselves. Keeps a
 * fresh account's sidebar compact by default instead of showing every
 * permitted item, which is the whole point of this feature. Easy to tune;
 * not load-bearing for correctness. */
const DEFAULT_PINNED_IDS = new Set([
  'nav:/dashboard',
  'nav:/customers',
  'fs:leads',
  'fs:deals',
  'native:contacts',
  'native:companies',
  'fs:workorders',
]);

/** Sidebar drag/pin/hide customization — a pure UI-ordering preference
 * layered on top of Sidebar.tsx's existing canNav()/canNavFlag() gating.
 * Callers must always filter their item list through those first; this hook
 * only ever reorders/splits an already-permitted list, never decides what's
 * permitted (mirrors the server-side invariant documented on
 * IUser.sidebarLayout in the backend's auth.model.ts).
 *
 * Every PUT sends the complete current layout (never a partial patch), so
 * last-write-wins is safe by construction — there's no diff to merge. An
 * in-flight request is aborted before a newer one is sent, and writes are
 * debounced, so a slow stale response can never land after a newer local
 * edit. */
export function useSidebarLayout() {
  const user = useAuthStore((s) => s.user);
  const setSidebarLayoutLocal = useAuthStore((s) => s.setSidebarLayout);

  const layout: SidebarLayout = user?.sidebarLayout ?? {};
  const items  = layout.items  ?? {};
  const groups = layout.groups ?? {};

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef       = useRef<AbortController | null>(null);

  const persist = useCallback((next: SidebarLayout) => {
    setSidebarLayoutLocal(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      authService.updateSidebarLayout(next, controller.signal).catch(() => {
        // Silent — the next edit resends the full (still-correct) local
        // state anyway, and a transient failure shouldn't surface as an
        // error for what is, worst case, a missed reorder sync.
      });
    }, DEBOUNCE_MS);
  }, [setSidebarLayoutLocal]);

  /** Sorts a permitted id list by custom order (default: catalog/array order). */
  const applyOrder = useCallback((ids: string[]): string[] => {
    return [...ids].sort((a, b) => {
      const oa = items[a]?.order ?? ids.indexOf(a);
      const ob = items[b]?.order ?? ids.indexOf(b);
      return oa - ob;
    });
  }, [items]);

  const isPinned = useCallback((id: string): boolean =>
    items[id]?.pinned ?? DEFAULT_PINNED_IDS.has(id), [items]);

  /** Splits+sorts a permitted id list into [pinned, unpinned], both in custom order. */
  const split = useCallback((ids: string[]): { pinned: string[]; unpinned: string[] } => {
    const ordered = applyOrder(ids);
    return {
      pinned:   ordered.filter((id) => isPinned(id)),
      unpinned: ordered.filter((id) => !isPinned(id)),
    };
  }, [applyOrder, isPinned]);

  const togglePin = useCallback((id: string) => {
    const nextPinned = !isPinned(id);
    const nextItems = { ...items, [id]: { ...items[id], pinned: nextPinned } };
    persist({ ...layout, items: nextItems });
  }, [items, isPinned, layout, persist]);

  /** Give it a category's ids in their new drag order; only those ids' order values change. */
  const reorder = useCallback((orderedIds: string[]) => {
    const nextItems = { ...items };
    orderedIds.forEach((id, idx) => {
      nextItems[id] = { ...nextItems[id], order: idx };
    });
    persist({ ...layout, items: nextItems });
  }, [items, layout, persist]);

  // Dynamic sections (CRM Data, Custom Modules) default to hidden too —
  // same "compact by default" rule as individual items, just at group
  // granularity since their contents aren't a fixed catalog.
  const isGroupVisible = useCallback((key: 'crmData' | 'customModules'): boolean =>
    groups[key] === true, [groups]);

  const toggleGroup = useCallback((key: 'crmData' | 'customModules') => {
    const nextGroups = { ...groups, [key]: !isGroupVisible(key) };
    persist({ ...layout, groups: nextGroups });
  }, [groups, isGroupVisible, layout, persist]);

  const resetToDefault = useCallback(() => {
    persist({ items: {}, groups: {} });
  }, [persist]);

  /** "Show All" — literally pins every given (already-permitted) id, plus
   * both dynamic groups. Only ever adds pins; never touches order, so
   * existing custom ordering survives. Distinct from resetToDefault, which
   * instead reverts to the small curated starter set. */
  const pinAll = useCallback((ids: string[]) => {
    const nextItems = { ...items };
    ids.forEach((id) => {
      nextItems[id] = { ...nextItems[id], pinned: true };
    });
    persist({ items: nextItems, groups: { crmData: true, customModules: true } });
  }, [items, persist]);

  return { isPinned, split, togglePin, reorder, isGroupVisible, toggleGroup, resetToDefault, pinAll };
}
