import api from '../../../services/api';
import toast from 'react-hot-toast';

export interface DownloadPdfOptions {
  module: 'quotations' | 'workorders' | 'invoices' | 'contracts';
  id: string;
  filename?: string;
  template?: string;
  templateId?: string;
}

/**
 * Downloads a generated PDF from the server for native CRM documents.
 * Correctly extracts server error messages even when Axios responseType is 'blob',
 * displays toast feedback, and avoids silent error swallowing.
 */
export async function downloadDocumentPdf({
  module,
  id,
  filename,
  template = 'classic',
  templateId,
}: DownloadPdfOptions): Promise<void> {
  const qs = new URLSearchParams();
  if (templateId) {
    qs.set('templateId', templateId);
  } else if (template) {
    qs.set('template', template);
  }

  const queryStr = qs.toString() ? `?${qs.toString()}` : '';

  try {
    const res = await api.get(`/api/v1/native-crm/pdf/${module}/${id}${queryStr}`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${module.slice(0, -1)}-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('PDF downloaded successfully');
  } catch (err: any) {
    let msg = 'Failed to download PDF';
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json?.message) msg = json.message;
      } catch {
        // Blob was not valid JSON
      }
    } else if (err?.response?.data?.message) {
      msg = err.response.data.message;
    } else if (err?.message) {
      msg = err.message;
    }
    toast.error(msg);
    throw new Error(msg);
  }
}
