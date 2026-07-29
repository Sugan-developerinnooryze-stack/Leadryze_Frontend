import { useMutation } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/template-analysis';

export interface TemplateAnalysisResult {
  elements:  any[];
  warnings:  string[];
}

/**
 * Upload an existing invoice/quotation/contract/workorder (PDF or image) and
 * get back a draft elements[] array. Nothing is saved server-side — the
 * result loads straight into the designer's current (unsaved) canvas state,
 * same as a brand-new blank template, only becoming a real CustomTemplate
 * when the user clicks "Save Template" themselves.
 */
export function useTemplateAnalysisMutation() {
  return useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      return api
        .post(BASE, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
        .then((r) => r.data.data as TemplateAnalysisResult);
    },
  });
}
