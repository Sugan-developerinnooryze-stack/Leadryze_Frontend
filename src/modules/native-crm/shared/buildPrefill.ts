export type DocType = 'quotation' | 'contract' | 'workorder' | 'invoice';

// Which ancestor-reference fields each document type's schema actually
// supports — matches the four backend models exactly (native-crm/
// quotations|contracts|workorders|invoices' *.model.ts). Single source of
// truth for which cross-references can be carried at all, so this stays
// correct for every possible tenant-configured order, not just one.
const SUPPORTED_REFS: Record<DocType, DocType[]> = {
  quotation: ['contract'],
  contract:  ['quotation'],
  workorder: ['contract', 'quotation'],
  invoice:   ['contract', 'quotation', 'workorder'],
};

// The field name used both as a document's own human-readable code AND as
// the field another document uses to reference it — deliberately the same
// name on both sides (see quotation.model.ts's own quotationId etc.), which
// is what makes `source[REF_FIELD[t]]` correct in both directions below.
const REF_FIELD: Record<DocType, string> = {
  quotation: 'quotationId',
  contract:  'contractId',
  workorder: 'workOrderId',
  invoice:   'invoiceId',
};

// Site/Staff/Team exist on Quotation, Contract and WorkOrder; Invoice has
// none of the three (financial document, not a schedulable/assignable one).
const SUPPORTS_SITE_STAFF_TEAM: Record<DocType, boolean> = {
  quotation: true, contract: true, workorder: true, invoice: false,
};

/** Build a pre-fill object for opening a new document form seeded from a
 * source document — works for any of the 12 possible from/to combinations
 * among the 4 document types (i.e. whichever two ended up adjacent in the
 * tenant's configured Document Workflow Order), not just one specific
 * sequence. Every field that's part of the shared "base" data (customer,
 * address, services, parts, discount, tax, notes) always carries over;
 * site/staff/team carry over whenever the target type supports them; the
 * ancestor-reference chain (contractId/quotationId/workOrderId) carries
 * over transitively — both a direct link to the source itself, and
 * whichever of the source's OWN ancestor references the target also has
 * room for — so the full lineage survives regardless of how many hops it
 * took to get there. */
export function buildPrefill(source: any, from: DocType, to: DocType): Record<string, any> {
  const out: Record<string, any> = {
    customerId:    source.customerId,
    address:       source.address       ?? '',
    services:      source.services      ?? [],
    parts:         source.parts         ?? [],
    discount:      source.discount      ?? 0,
    gstPercentage: source.gstPercentage ?? 0,
    notes:         source.notes         ?? '',
    title: from === 'contract' && to === 'workorder'
      ? `Service Visit — ${source.title ?? ''}`
      : (source.title ?? ''),
  };

  if (SUPPORTS_SITE_STAFF_TEAM[to]) {
    out.siteId  = source.siteId  ?? '';
    out.staffId = source.staffId ?? '';
    out.teamId  = source.teamId  ?? '';
  }

  for (const ancestorType of SUPPORTED_REFS[to]) {
    const field = REF_FIELD[ancestorType];
    if (ancestorType === from) {
      out[field] = source[field]; // direct link to the source itself
    } else if (SUPPORTED_REFS[from]?.includes(ancestorType)) {
      out[field] = source[field]; // inherited from the source's own ancestor reference
    }
  }

  return out;
}
