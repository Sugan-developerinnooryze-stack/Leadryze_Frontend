import { useRef, useState } from 'react';
import { TrashIcon, ArrowUpTrayIcon, DocumentIcon } from '@heroicons/react/24/outline';
import {
  useTicketAttachmentsQuery, useTicketAttachmentUpload, useTicketAttachmentDelete,
} from '../queries/ticket-attachments.queries';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TicketAttachmentsPanel({ ticketId }: { ticketId: string }) {
  const { data: attachments = [], isLoading } = useTicketAttachmentsQuery(ticketId);
  const upload = useTicketAttachmentUpload(ticketId);
  const remove = useTicketAttachmentDelete(ticketId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      await upload.mutateAsync(file);
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'Upload failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted">{attachments.length} file{attachments.length === 1 ? '' : 's'}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-primary text-xs font-medium rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60"
        >
          <ArrowUpTrayIcon className="h-3.5 w-3.5" />
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
      </div>

      {uploadError && <p className="text-xs text-danger-500 mb-2">{uploadError}</p>}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-text-muted">No attachments yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {attachments.map((a: any) => (
            <div key={a._id} className="relative group border border-border rounded-lg overflow-hidden bg-background">
              <a href={a.url} target="_blank" rel="noreferrer" className="block">
                {a.mimetype?.startsWith('image/') ? (
                  <img src={a.url} alt={a.filename} className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center">
                    <DocumentIcon className="h-8 w-8 text-text-muted/70" />
                  </div>
                )}
              </a>
              <div className="px-2 py-1.5 bg-surface">
                <p className="text-[11px] text-text-primary truncate" title={a.filename}>{a.filename}</p>
                <p className="text-[10px] text-text-muted">{fmtSize(a.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(a._id)}
                title="Delete"
                className="absolute top-1 right-1 p-1 rounded-full bg-surface/90 text-text-muted hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
