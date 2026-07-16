export type DocType = 'quotation' | 'contract' | 'workorder' | 'invoice';

/** Build a pre-fill object for opening a new document form seeded from a source document. */
export function buildPrefill(source: any, from: DocType, to: DocType): Record<string, any> {
  const base: Record<string, any> = {
    customerId:    source.customerId,
    services:      source.services      ?? [],
    parts:         source.parts         ?? [],
    discount:      source.discount      ?? 0,
    gstPercentage: source.gstPercentage ?? 0,
    notes:         source.notes         ?? '',
  };

  if (from === 'quotation' && to === 'workorder') {
    return { ...base, quotationId: source.quotationId, title: source.title ?? '' };
  }
  if (from === 'quotation' && to === 'invoice') {
    return { ...base, quotationId: source.quotationId };
  }
  if (from === 'quotation' && to === 'contract') {
    return { ...base, quotationId: source.quotationId, title: source.title ?? '' };
  }
  if (from === 'workorder' && to === 'invoice') {
    return { ...base, workOrderId: source.workOrderId, title: source.title ?? '' };
  }
  if (from === 'contract' && to === 'workorder') {
    return {
      ...base,
      contractId: source.contractId,
      title:      `Service Visit — ${source.title ?? ''}`,
      staffId:    source.staffId  ?? '',
      teamId:     source.teamId   ?? '',
    };
  }
  if (from === 'contract' && to === 'invoice') {
    return { ...base, contractId: source.contractId };
  }
  if (from === 'contract' && to === 'quotation') {
    return { ...base, title: source.title ?? '' };
  }

  return base;
}
