import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { ALL_FLAGS_TRUE, type FeatureFlags } from '../../../stores/featureFlags.store';
import { AdminLoadingState } from '../shared/AdminCard';
import { FeatureFlagsEditor } from '../shared/FeatureFlagsEditor';
import { FLAG_GROUPS } from '../tenants/TenantControlsTab';

/** The template every new tenant inherits at creation time, and what a
 * tenant on accessConfigMode:'default' has as its effective flags right
 * now. Editing here never touches a tenant already set to Customize. */
export default function PlatformDefaultsPage() {
  const [flags, setFlags]     = useState<FeatureFlags>(ALL_FLAGS_TRUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authService.adminGetPlatformDefaults()
      .then((r) => setFlags({ ...ALL_FLAGS_TRUE, ...r.data.data.flags }))
      .catch(() => toast.error('Failed to load platform defaults'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = useCallback((key: keyof FeatureFlags, val: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: val }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await authService.adminSetPlatformDefaults(flags as unknown as Record<string, boolean>);
      toast.success('Platform defaults saved');
    } catch {
      toast.error('Failed to save platform defaults');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading platform defaults…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Platform Defaults</h1>
        <p className="text-sm text-text-muted mt-0.5">
          The template new tenants inherit automatically, and what any tenant on "Use System Default" is currently showing. Editing here never changes a tenant that's been individually customized.
        </p>
      </div>

      <FeatureFlagsEditor groups={FLAG_GROUPS} flags={flags as unknown as Record<string, boolean>} onChange={toggle} />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Saving…' : 'Save Platform Defaults'}
      </button>
    </div>
  );
}
