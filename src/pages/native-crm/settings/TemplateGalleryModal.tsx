import { XMarkIcon, SparklesIcon, UserIcon, TrashIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { useAutomationTemplatesQuery, useDeleteAutomationTemplate, AutomationTemplate } from '../../../modules/native-crm/queries/automation-templates.queries';

interface TemplateGalleryModalProps {
  onClose: () => void;
  onUseTemplate: (templateId: string) => void;
}

function TemplateCard({ template, isSystem, onUse, onDelete }: {
  template: AutomationTemplate; isSystem: boolean; onUse: () => void; onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 hover:border-ryze-300 dark:border-ryze-700 hover:shadow-sm transition-all flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-text-primary">{template.name}</h3>
        {!isSystem && onDelete && (
          <button onClick={onDelete} className="p-1 text-text-muted hover:text-red-500 shrink-0" title="Delete this template">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {template.description && <p className="text-xs text-text-muted mb-3 flex-1">{template.description}</p>}
      <div className="flex items-center gap-1.5 mb-3">
        {template.category && <span className="badge badge-gray text-[10px]">{template.category}</span>}
        {template.triggerModule && <span className="badge badge-blue text-[10px]">{template.triggerModule}</span>}
      </div>
      <button onClick={onUse} className="w-full px-3 py-2 bg-ryze-600 text-white text-xs font-medium rounded-lg hover:bg-ryze-700">
        Use this template
      </button>
    </div>
  );
}

/** System Templates (tenantId:null — the 5 seeded starters, available to
 * every tenant, read-only, no delete affordance) vs. My Templates (this
 * tenant's own "saved as template" flows, deletable) — two visually
 * distinct sections over one already-scoped list result (see
 * useAutomationTemplatesQuery's own backend $or), not two separate fetches. */
export default function TemplateGalleryModal({ onClose, onUseTemplate }: TemplateGalleryModalProps) {
  const { data: templates = [], isLoading } = useAutomationTemplatesQuery();
  const deleteMut = useDeleteAutomationTemplate();

  const systemTemplates = templates.filter((t) => t.tenantId === null);
  const myTemplates = templates.filter((t) => t.tenantId !== null);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <RectangleStackIcon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" /> Automation Templates
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted"><XMarkIcon className="h-5 w-5" /></button>
          </div>

          {isLoading && <p className="text-sm text-text-muted">Loading templates…</p>}

          {!isLoading && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-1.5 mb-3">
                  <SparklesIcon className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">System Templates</h3>
                  <span className="text-[10px] text-text-muted">— available to everyone, read-only</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {systemTemplates.map((t) => (
                    <TemplateCard key={t._id} template={t} isSystem onUse={() => onUseTemplate(t._id)} />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <UserIcon className="h-4 w-4 text-text-muted" />
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">My Templates</h3>
                  <span className="text-[10px] text-text-muted">— created by your team, reuse or delete anytime</span>
                </div>
                {myTemplates.length === 0 ? (
                  <p className="text-xs text-text-muted">No saved templates yet — use "Save as template" from any flow you've built.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myTemplates.map((t) => (
                      <TemplateCard
                        key={t._id} template={t} isSystem={false}
                        onUse={() => onUseTemplate(t._id)}
                        onDelete={() => { if (window.confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t._id); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
