import { useState, useRef } from 'react';
import {
  useWorkflowTemplatesQuery,
  useWorkflowTemplateCreate,
  useWorkflowTemplateUpdate,
  useWorkflowTemplateDelete,
  useWorkflowTemplateSetDefault,
  WorkflowTemplate,
  WorkflowStep,
} from '../../../modules/native-crm/queries/workflow-templates.queries';

type DocType = 'quotation' | 'contract' | 'workorder' | 'invoice';

const DOC_META: Record<DocType, { label: string; color: string; chip: string }> = {
  quotation: { label: 'Quotation',   color: 'blue',   chip: 'bg-blue-100 text-blue-700 border-blue-300' },
  contract:  { label: 'Contract',    color: 'purple', chip: 'bg-purple-100 text-purple-700 border-purple-300' },
  workorder: { label: 'Work Order',  color: 'amber',  chip: 'bg-amber-100 text-amber-700 border-amber-300' },
  invoice:   { label: 'Invoice',     color: 'green',  chip: 'bg-green-100 text-green-700 border-green-300' },
};

const PALETTE: DocType[] = ['quotation', 'contract', 'workorder', 'invoice'];

export default function WorkflowBuilderPage() {
  const { data: templates = [], isLoading } = useWorkflowTemplatesQuery();
  const createTpl  = useWorkflowTemplateCreate();
  const updateTpl  = useWorkflowTemplateUpdate();
  const deleteTpl  = useWorkflowTemplateDelete();
  const setDefault = useWorkflowTemplateSetDefault();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [steps, setSteps]           = useState<WorkflowStep[]>([]);
  const [dirty, setDirty]           = useState(false);

  const dragSrc = useRef<{ from: 'palette' | 'sequence'; docType?: DocType; index?: number } | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function loadTemplate(tpl: WorkflowTemplate) {
    setSelectedId(tpl._id);
    setName(tpl.name);
    setSteps([...tpl.steps].sort((a, b) => a.order - b.order));
    setDirty(false);
  }

  function handleNewTemplate() {
    setSelectedId(null);
    setName('New Template');
    setSteps([]);
    setDirty(true);
  }

  function addStep(docType: DocType) {
    const next: WorkflowStep = {
      docType,
      label: DOC_META[docType].label,
      order: steps.length,
      color: DOC_META[docType].color,
    };
    setSteps([...steps, next]);
    setDirty(true);
  }

  function removeStep(idx: number) {
    const next = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
    setSteps(next);
    setDirty(true);
  }

  // Drag-and-drop from palette
  function onPaletteDragStart(docType: DocType) {
    dragSrc.current = { from: 'palette', docType };
  }

  // Drag-and-drop to reorder sequence
  function onSeqDragStart(idx: number) {
    dragSrc.current = { from: 'sequence', index: idx };
  }

  function onSeqDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function onSeqDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const src = dragSrc.current;
    if (!src) return;

    if (src.from === 'palette' && src.docType) {
      const inserted = [
        ...steps.slice(0, dropIdx),
        { docType: src.docType, label: DOC_META[src.docType].label, order: dropIdx, color: DOC_META[src.docType].color },
        ...steps.slice(dropIdx),
      ].map((s, i) => ({ ...s, order: i }));
      setSteps(inserted);
      setDirty(true);
    } else if (src.from === 'sequence' && src.index !== undefined) {
      if (src.index === dropIdx) return;
      const next = [...steps];
      const [moved] = next.splice(src.index, 1);
      next.splice(dropIdx, 0, moved);
      setSteps(next.map((s, i) => ({ ...s, order: i })));
      setDirty(true);
    }
    dragSrc.current = null;
  }

  function onDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    const src = dragSrc.current;
    if (!src) return;
    if (src.from === 'palette' && src.docType) {
      addStep(src.docType);
    }
    dragSrc.current = null;
  }

  async function handleSave() {
    const payload = { name, steps };
    if (selectedId) {
      await updateTpl.mutateAsync({ id: selectedId, data: payload });
    } else {
      const res = await createTpl.mutateAsync(payload as any);
      const created = (res.data?.data) as WorkflowTemplate | undefined;
      if (created?._id) setSelectedId(created._id);
    }
    setDirty(false);
  }

  async function handleSetDefault() {
    if (!selectedId) return;
    await setDefault.mutateAsync(selectedId);
  }

  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm('Delete this template?')) return;
    await deleteTpl.mutateAsync(selectedId);
    setSelectedId(null);
    setName('');
    setSteps([]);
    setDirty(false);
  }

  const selected = templates.find((t) => t._id === selectedId);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar — template list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Templates</h2>
          <button
            onClick={handleNewTemplate}
            className="text-xs px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            + New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="text-sm text-gray-500 p-2">Loading...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-400 p-2">No templates yet.</p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl._id}
                onClick={() => loadTemplate(tpl)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  selectedId === tpl._id
                    ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-300 dark:border-brand-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tpl.name}</span>
                  {tpl.isDefault && (
                    <span className="ml-2 flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{tpl.steps.length} step{tpl.steps.length !== 1 ? 's' : ''}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — builder */}
      {(selectedId !== null || dirty) ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-4">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
              className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-brand-500 outline-none text-gray-800 dark:text-gray-100 py-0.5"
              placeholder="Template name"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!dirty || createTpl.isPending || updateTpl.isPending}
                className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium"
              >
                {(createTpl.isPending || updateTpl.isPending) ? 'Saving...' : 'Save'}
              </button>
              {selectedId && (
                <>
                  <button
                    onClick={handleSetDefault}
                    disabled={selected?.isDefault || setDefault.isPending}
                    className="px-4 py-2 text-sm rounded-md border border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 font-medium"
                  >
                    {selected?.isDefault ? 'Default' : 'Set Default'}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm rounded-md border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Palette */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Drag document types into the pipeline
              </p>
              <div className="flex gap-3 flex-wrap">
                {PALETTE.map((dt) => (
                  <div
                    key={dt}
                    draggable
                    onDragStart={() => onPaletteDragStart(dt)}
                    className={`cursor-grab active:cursor-grabbing px-4 py-2 rounded-lg border text-sm font-medium select-none ${DOC_META[dt].chip}`}
                  >
                    {DOC_META[dt].label}
                  </div>
                ))}
              </div>
            </div>

            {/* Sequence drop zone */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Pipeline sequence
              </p>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropZoneDrop}
                className={`min-h-[80px] flex flex-wrap gap-3 items-start p-4 rounded-xl border-2 border-dashed transition-colors ${
                  steps.length === 0
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
                    : 'border-transparent bg-gray-50 dark:bg-gray-800/30'
                }`}
              >
                {steps.length === 0 && (
                  <p className="text-sm text-gray-400 w-full text-center py-4">
                    Drop document types here to build your pipeline
                  </p>
                )}
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => onSeqDragStart(idx)}
                    onDragOver={(e) => onSeqDragOver(e, idx)}
                    onDrop={(e) => onSeqDrop(e, idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-all ${
                      DOC_META[step.docType].chip
                    } ${dragOverIdx === idx ? 'ring-2 ring-brand-400 scale-105' : ''}`}
                  >
                    <span className="text-gray-400 mr-1 font-mono text-xs">{idx + 1}</span>
                    {step.label}
                    <button
                      onClick={() => removeStep(idx)}
                      className="ml-1 text-gray-400 hover:text-red-500 text-xs leading-none"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Arrow preview */}
              {steps.length > 0 && (
                <div className="mt-4 flex items-center flex-wrap gap-1">
                  {steps.map((step, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${DOC_META[step.docType].chip}`}>
                        {step.label}
                      </span>
                      {idx < steps.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm">Select a template or create a new one</p>
          </div>
        </div>
      )}
    </div>
  );
}
