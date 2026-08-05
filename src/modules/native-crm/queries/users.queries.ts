import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const KEY = ['users', 'list'] as const;

/** Platform login users (Settings -> Users), not a native-crm FS module —
 * lives alongside the other lookup-data hooks purely because FSDrawer's
 * generic lookup mechanism is the consumer (the "Manager" picker on the
 * Team form). Same api.get('/api/v1/users') the Settings page itself
 * already calls directly, just as a cached, reusable hook. */
export function useUsersListQuery(params: { limit?: number } = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get('/api/v1/users', { params: { limit: params.limit ?? 100 } }).then((r) => ({
        items: (r.data.data ?? []) as Array<{ _id: string; email: string; firstName?: string; lastName?: string; role: string }>,
      })),
  });
}
