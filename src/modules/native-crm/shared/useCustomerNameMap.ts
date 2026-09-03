import { useMemo } from 'react';
import { useCustomersListQuery } from '../queries/customers.queries';

/** Resolves a Field Service Customer's own business-friendly customerId
 * (e.g. "BADE2FF4-CUS-0019", stamped by NativeCustomer's own pre-save hook —
 * see customer.model.ts) to its display name — the SAME lookup dataset
 * FSDrawer.tsx's own `type: 'lookup'` form fields already fetch
 * (useCustomersListQuery({page:1, limit:500})), just reused here for TABLE
 * display instead of a form dropdown. Quotations/Work Orders/Contracts/
 * Invoices/Receipts all store this same plain customerId string (not a
 * Mongo ref — customer.model.ts's own customerId can't be Mongoose
 * `.populate()`d), so every one of those list pages needs this same
 * resolution rather than each re-fetching/re-mapping independently. */
export function useCustomerNameMap(): Map<string, string> {
  const { data } = useCustomersListQuery({ page: 1, limit: 500 });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.items ?? []) {
      if (c.customerId) map.set(c.customerId, c.name);
    }
    return map;
  }, [data]);
}
