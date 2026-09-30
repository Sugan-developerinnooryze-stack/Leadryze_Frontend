import { useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CustomizableItem } from './Sidebar';

interface Props {
  /** Only the currently-pinned items, per category — order here is what
   * gets reordered. Unpinned items aren't shown; that's the More flyout's
   * job, not this one's. */
  categories: { key: string; label: string; items: CustomizableItem[] }[];
  reorder: (orderedIds: string[]) => void;
  resetToDefault: () => void;
  onClose: () => void;
}

/** Drag-to-reorder only — deliberately has no pin/unpin control anywhere in
 * this component. That's the whole fix for the accidental-unpin problem
 * from the previous iteration: the action doesn't exist here to misclick.
 * Same plain-HTML5-drag-events idiom as ColumnEditor.tsx
 * (frontend/src/modules/crm/shared/ColumnEditor.tsx:33-60). Every drag
 * applies immediately via the debounced-persist hook already wired in
 * Sidebar.tsx, so there's nothing staged to discard — Done just closes. */
export default function SidebarCustomizeModal({ categories, reorder, resetToDefault, onClose }: Props) {
  const dragCategoryRef = useRef<string | null>(null);
  const dragFromIdRef   = useRef<string | null>(null);

  const onDragStart = (categoryKey: string, id: string) => {
    dragCategoryRef.current = categoryKey;
    dragFromIdRef.current = id;
  };
  const onDragEnter = (categoryKey: string, overId: string, currentIds: string[]) => {
    const fromId = dragFromIdRef.current;
    if (dragCategoryRef.current !== categoryKey || !fromId || fromId === overId) return;
    const fromIdx = currentIds.indexOf(fromId);
    const overIdx = currentIds.indexOf(overId);
    if (fromIdx === -1 || overIdx === -1) return;
    const next = [...currentIds];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(overIdx, 0, moved);
    reorder(next);
  };
  const onDragEnd = () => {
    dragCategoryRef.current = null;
    dragFromIdRef.current = null;
  };

  const nonEmptyCategories = categories.filter((c) => c.items.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">

          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold text-text-primary">Customize Sidebar</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {nonEmptyCategories.length === 0 && (
              <p className="text-sm text-text-muted text-center py-10">
                Nothing pinned yet — open More to add items to your sidebar first.
              </p>
            )}
            {nonEmptyCategories.map((cat) => {
              const ids = cat.items.map((i) => i.id);
              return (
                <div key={cat.key}>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-2 mb-1.5">{cat.label}</p>
                  <div className="space-y-1">
                    {cat.items.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => onDragStart(cat.key, item.id)}
                        onDragEnter={() => onDragEnter(cat.key, item.id, ids)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={onDragEnd}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border bg-surface cursor-grab active:cursor-grabbing select-none"
                      >
                        <span className="text-text-muted/60 shrink-0 text-sm leading-none" title="Drag to reorder">⠿</span>
                        <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                        <span className="flex-1 text-sm text-text-primary truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
            <button onClick={resetToDefault} className="text-sm text-danger-500 hover:underline">
              Reset to Default
            </button>
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
