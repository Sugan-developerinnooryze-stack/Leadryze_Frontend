import { useEffect, useRef, useState } from 'react';
import {
  XMarkIcon, MagnifyingGlassIcon, CircleStackIcon, TableCellsIcon,
} from '@heroicons/react/24/outline';
import type { CustomizableCategory } from './Sidebar';

interface Props {
  /** Already RBAC/flag-filtered — see Sidebar.tsx's customizableCategories. */
  categories: CustomizableCategory[];
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void;
  /** Reorder within the currently-selected category — same drag idiom as
   * the Customize modal, available directly here too now so reordering
   * doesn't require leaving More. */
  reorder: (orderedIds: string[]) => void;
  isGroupVisible: (key: 'crmData' | 'customModules') => boolean;
  toggleGroup: (key: 'crmData' | 'customModules') => void;
  hasCrmDataGroup: boolean;
  hasCustomModulesGroup: boolean;
  /** "Show All" — pins every permitted item across every category (plus
   * both dynamic groups), so it always produces a visible result no matter
   * which category is currently open. */
  pinAll: (ids: string[]) => void;
  /** "Reset to Default" — the undo for Show All (and for any other pin/
   * order customization): reverts everything back to the small curated
   * starter set. Same action the separate Customize modal exposes, kept
   * here too so Show All always has a nearby way back. */
  resetToDefault: () => void;
  /** Pixel offset from the viewport's left edge — 56 behind the collapsed
   * rail, 240 behind the expanded sidebar — so this always sits immediately
   * beside whichever one is currently showing. */
  anchorLeft: number;
  onClose: () => void;
}

/** The left column's groupings. Mostly the same top-level categories the
 * main sidebar itself uses, but CRM Data / Custom Modules are each their
 * own separate row here (not folded into Native CRM / Configuration) — the
 * main sidebar renders them as two genuinely separate collapsible sections
 * under one shared "CRM" / "Configuration" plain-text label, and this left
 * column mirrors that as two distinct entries rather than merging them. */
const LEFT_GROUPS: { key: string; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'engage',       label: 'Engage' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'platform',     label: 'Platform' },
  { key: 'crmData',      label: 'CRM Data' },
  { key: 'nativeCrm',    label: 'Native CRM' },
  { key: 'fieldService', label: 'Field Service' },
  { key: 'configuration',label: 'Configuration' },
  { key: 'customModules',label: 'Custom Modules' },
  { key: 'automation',   label: 'Automation' },
];

/** crmData / customModules are synthetic — group-level toggles with no
 * fixed item catalog, so they don't correspond to a real
 * customizableCategories entry the way every other left-column key does. */
const isDynamicGroupKey = (key: string): key is 'crmData' | 'customModules' =>
  key === 'crmData' || key === 'customModules';

/** HubSpot-style "More" — two columns: hover (or click) a category on the
 * left, browse/pin/unpin/reorder its items on the right. Pin toggle and
 * drag handle are two physically separate controls at opposite ends of the
 * row (not the same click target the row itself used to be) specifically
 * so a drag can never be mistaken for an accidental unpin. Every action
 * here is immediate — no Done/Cancel, since there's nothing staged. */
export default function SidebarMorePanel({
  categories, isPinned, togglePin, reorder, isGroupVisible, toggleGroup,
  hasCrmDataGroup, hasCustomModulesGroup, pinAll, resetToDefault, anchorLeft, onClose,
}: Props) {
  const everyItemId = categories.flatMap((c) => c.items.map((i) => i.id));

  const visibleLeftGroups = LEFT_GROUPS.filter(({ key }) => {
    if (key === 'crmData') return hasCrmDataGroup;
    if (key === 'customModules') return hasCustomModulesGroup;
    const cat = categories.find((c) => c.key === key);
    return !!cat && cat.items.length > 0;
  });

  const [selectedKey, setSelectedKey] = useState(visibleLeftGroups[0]?.key ?? '');
  const [search, setSearch] = useState('');

  // Entrance animation — starts hidden/scaled-down, flips true one frame
  // after mount so the transition actually plays instead of snapping in.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedCategory = isDynamicGroupKey(selectedKey) ? undefined : categories.find((c) => c.key === selectedKey);
  const q = search.trim().toLowerCase();
  const items = (selectedCategory?.items ?? []).filter((i) => !q || i.label.toLowerCase().includes(q));

  // Drag-to-reorder, directly in the right column — same plain-HTML5-
  // drag-events idiom as the Customize modal (and ColumnEditor.tsx before
  // that). Only enabled with no active search, since a filtered subset's
  // on-screen order doesn't map onto real positions. The drag handle and
  // pin toggle sit at opposite ends of the row with generous spacing
  // between them specifically so they're never one misclick apart.
  const dragFromIdRef = useRef<string | null>(null);
  const allItemIds = selectedCategory?.items.map((i) => i.id) ?? [];
  const onDragStart = (id: string) => { dragFromIdRef.current = id; };
  const onDragEnter = (overId: string) => {
    const fromId = dragFromIdRef.current;
    if (!fromId || fromId === overId) return;
    const fromIdx = allItemIds.indexOf(fromId);
    const overIdx = allItemIds.indexOf(overId);
    if (fromIdx === -1 || overIdx === -1) return;
    const next = [...allItemIds];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(overIdx, 0, moved);
    reorder(next);
  };
  const onDragEnd = () => { dragFromIdRef.current = null; };

  return (
    <>
      {/* Invisible click-catcher for outside-click-to-close — deliberately no
       * bg tint/blur here, the rest of the page must stay exactly as it
       * looks normally, not dimmed or hazy behind the panel. */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        className={`fixed top-1/2 -translate-y-1/2 z-[60] flex border border-ryze-500/30 dark:border-ryze-400/30 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ease-out origin-left ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          left: anchorLeft,
          maxHeight: 'min(480px, calc(100vh - 5rem))',
          width: 480,
          background: 'rgb(var(--color-surface) / 0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Left column — categories */}
        <div className="w-40 shrink-0 border-r border-border bg-black/[0.02] dark:bg-white/[0.03] flex flex-col">
          <div className="px-3 py-3 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">More</span>
            <button onClick={onClose} className="p-1 -mr-1 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {visibleLeftGroups.map((g) => (
              <button
                key={g.key}
                onMouseEnter={() => setSelectedKey(g.key)}
                onClick={() => { setSelectedKey(g.key); setSearch(''); }}
                className={`w-full flex items-center justify-between gap-1 px-3 py-2 text-sm text-left transition-colors ${
                  selectedKey === g.key
                    ? 'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400 font-medium'
                    : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary'
                }`}
              >
                <span className="truncate">{g.label}</span>
                {selectedKey === g.key && <span className="text-xs shrink-0">›</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2 shrink-0 space-y-0.5">
            <button
              onClick={() => pinAll(everyItemId)}
              title="Pin every item to the sidebar"
              className="w-full px-2 py-1.5 text-xs font-medium rounded-lg text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors"
            >
              Show All
            </button>
            <button
              onClick={resetToDefault}
              title="Revert to the default sidebar"
              className="w-full px-2 py-1.5 text-xs font-medium rounded-lg text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Right column — the selected category's items */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-sm font-semibold text-text-primary mb-2 truncate">
              {LEFT_GROUPS.find((g) => g.key === selectedKey)?.label ?? ''}
            </p>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-background text-text-primary border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ryze-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isDynamicGroupKey(selectedKey) ? (
              (!q || selectedKey.toLowerCase().includes(q) || (selectedKey === 'crmData' ? 'crm data' : 'custom modules').includes(q)) && (
                // Only one togglable row for a dynamic group — centered in
                // the available space instead of pinned to the top, since
                // the left column's longer category list otherwise leaves
                // this column with a lot of empty space below a top-anchored row.
                <div className="h-full min-h-[160px] flex items-center justify-center">
                  <button
                    onClick={() => toggleGroup(selectedKey)}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm text-text-primary border border-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {selectedKey === 'crmData'
                      ? <CircleStackIcon className="h-4 w-4 shrink-0 text-text-muted" />
                      : <TableCellsIcon className="h-4 w-4 shrink-0 text-text-muted" />}
                    <span className="truncate">{selectedKey === 'crmData' ? 'CRM Data' : 'Custom Modules'}</span>
                    <span className={isGroupVisible(selectedKey) ? 'text-ryze-600 dark:text-ryze-400' : 'text-text-muted/50'}>
                      {isGroupVisible(selectedKey) ? '📌' : '○'}
                    </span>
                  </button>
                </div>
              )
            ) : (
            <div className="space-y-0.5">
            {items.map((item) => {
              const pinned = isPinned(item.id);
              const draggableNow = !q;
              return (
                <div
                  key={item.id}
                  draggable={draggableNow}
                  onDragStart={() => draggableNow && onDragStart(item.id)}
                  onDragEnter={() => draggableNow && onDragEnter(item.id)}
                  onDragOver={(e) => draggableNow && e.preventDefault()}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-2 px-1.5 py-2 rounded-lg text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors ${draggableNow ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {draggableNow && (
                    <span className="text-text-muted/40 shrink-0 text-xs leading-none px-1" title="Drag to reorder">⠿</span>
                  )}
                  <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                  <span className="flex-1 truncate">{item.label}</span>
                  <button
                    onClick={() => togglePin(item.id)}
                    title={pinned ? 'Unpin — move to More' : 'Pin to sidebar'}
                    className={`shrink-0 px-2 py-1 rounded-md text-sm transition-colors ${pinned ? 'text-ryze-600 dark:text-ryze-400 hover:bg-ryze-600/10' : 'text-text-muted/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'}`}
                  >
                    {pinned ? '📌' : '○'}
                  </button>
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">
                {q ? `No modules match "${search}"` : 'Nothing here.'}
              </p>
            )}
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
