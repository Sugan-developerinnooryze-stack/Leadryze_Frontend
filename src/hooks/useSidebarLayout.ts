import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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

const CUSTOM_DEFAULT_STORAGE_KEY = (userId?: string) => `sidebar_custom_default_${userId ?? 'user'}`;
const PRE_SHOW_ALL_STORAGE_KEY   = (userId?: string) => `sidebar_pre_show_all_${userId ?? 'user'}`;

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

  const [hasCustomDefault, setHasCustomDefault] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(CUSTOM_DEFAULT_STORAGE_KEY(user?._id)));
    } catch {
      return false;
    }
  });

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

  /** Saves the user's current pinned selection & order as their own default layout */
  const saveAsDefault = useCallback(() => {
    try {
      const key = CUSTOM_DEFAULT_STORAGE_KEY(user?._id);
      localStorage.setItem(key, JSON.stringify(layout));
      setHasCustomDefault(true);
      toast.success('Current sidebar layout saved as default');
    } catch {
      toast.error('Failed to save default layout');
    }
  }, [layout, user?._id]);

  /** "Show All" — pins every given (already-permitted) id, plus
   * both dynamic groups. Saves a snapshot of current layout first so user can revert! */
  const pinAll = useCallback((ids: string[]) => {
    try {
      localStorage.setItem(PRE_SHOW_ALL_STORAGE_KEY(user?._id), JSON.stringify(layout));
    } catch {}

    const nextItems = { ...items };
    ids.forEach((id) => {
      nextItems[id] = { ...nextItems[id], pinned: true };
    });
    persist({ items: nextItems, groups: { crmData: true, customModules: true } });
  }, [items, layout, persist, user?._id]);

  /** Checks if all given items are currently pinned */
  const isAllPinned = useCallback((allIds: string[]): boolean => {
    if (!allIds || allIds.length === 0) return false;
    return allIds.every((id) => isPinned(id)) && groups.crmData === true && groups.customModules === true;
  }, [isPinned, groups]);

  /** Restores the layout snapshot from before "Show All" was clicked */
  const restorePreShowAll = useCallback(() => {
    try {
      const key = PRE_SHOW_ALL_STORAGE_KEY(user?._id);
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        localStorage.removeItem(key);
        persist(parsed);
        toast.success('Restored previous sidebar layout');
        return;
      }
    } catch {}
    // If no pre-show-all snapshot exists, fall back to resetToDefault
    resetToDefault();
  }, [user?._id, persist]);

  /** Smart reset:
   * 1. If currently in Show All mode, restores pre-show-all snapshot (preserves pinned items like Campaigns!)
   * 2. If client has set their own default layout via "Set as Default", restores that!
   * 3. Otherwise reverts to factory system defaults. */
  const resetToDefault = useCallback(() => {
    // 1. Snapshot from before Show All
    try {
      const preKey = PRE_SHOW_ALL_STORAGE_KEY(user?._id);
      const preSaved = localStorage.getItem(preKey);
      if (preSaved) {
        const parsed = JSON.parse(preSaved);
        localStorage.removeItem(preKey);
        persist(parsed);
        toast.success('Restored your sidebar layout');
        return;
      }
    } catch {}

    // 2. Client's own saved default
    try {
      const defKey = CUSTOM_DEFAULT_STORAGE_KEY(user?._id);
      const defSaved = localStorage.getItem(defKey);
      if (defSaved) {
        const parsed = JSON.parse(defSaved);
        persist(parsed);
        toast.success('Reset to your custom default setup');
        return;
      }
    } catch {}

    // 3. Fallback to system default
    persist({ items: {}, groups: {} });
    toast.success('Reset to system default');
  }, [user?._id, persist]);

  /** Hard reset to factory default, clearing custom default */
  const resetToSystemDefault = useCallback(() => {
    try {
      localStorage.removeItem(PRE_SHOW_ALL_STORAGE_KEY(user?._id));
      localStorage.removeItem(CUSTOM_DEFAULT_STORAGE_KEY(user?._id));
      setHasCustomDefault(false);
    } catch {}
    persist({ items: {}, groups: {} });
    toast.success('Reset to system default');
  }, [user?._id, persist]);

  return {
    isPinned,
    split,
    togglePin,
    reorder,
    isGroupVisible,
    toggleGroup,
    resetToDefault,
    resetToSystemDefault,
    pinAll,
    restorePreShowAll,
    saveAsDefault,
    hasCustomDefault,
    isAllPinned,
  };
}
