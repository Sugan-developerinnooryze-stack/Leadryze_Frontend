import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

export interface TemplateDocViewerHandle {
  print: () => void;
}

interface TemplateDocViewerProps {
  module:      string; // 'invoices' | 'quotations' | 'contracts' | 'workorders'
  docId:       string;
  templateId:  string;
}

/**
 * Renders a document through its backend designer template (the same HTML
 * Puppeteer receives for the PDF) inside an iframe — what you see here IS the
 * downloaded/emailed PDF. Exposes print() so toolbar Print buttons can print
 * the template output instead of the page.
 */
const TemplateDocViewer = forwardRef<TemplateDocViewerHandle, TemplateDocViewerProps>(
  function TemplateDocViewer({ module, docId, templateId }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const { data: html, isLoading, error } = useQuery({
      queryKey: ['native-crm', 'pdf-preview', module, docId, templateId],
      queryFn: () =>
        api.get(`/api/v1/native-crm/pdf/${module}/${docId}/preview-html`, {
          params: { templateId },
          responseType: 'text' as const,
        }).then((r) => r.data as string),
      enabled: !!docId && !!templateId,
    });

    useImperativeHandle(ref, () => ({
      print: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.focus();
        win.print();
      },
    }));

    if (isLoading) {
      return (
        <div className="w-[210mm] min-h-[297mm] mx-auto my-8 bg-white shadow-xl flex items-center justify-center text-sm text-gray-400">
          Rendering template…
        </div>
      );
    }
    if (error || !html) {
      return (
        <div className="w-[210mm] min-h-[297mm] mx-auto my-8 bg-white shadow-xl flex items-center justify-center text-sm text-red-400">
          Failed to render template
        </div>
      );
    }
    return (
      <iframe
        ref={iframeRef}
        title="document"
        srcDoc={html}
        className="w-[210mm] min-h-[297mm] mx-auto my-8 bg-white shadow-xl print:my-0 print:shadow-none block"
        style={{ border: 'none', height: '297mm' }}
      />
    );
  }
);

export default TemplateDocViewer;
