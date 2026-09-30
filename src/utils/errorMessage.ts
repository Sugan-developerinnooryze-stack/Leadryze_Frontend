// The backend's `validate` middleware responds with a generic "Validation
// failed" message plus a per-field `errors` map (zod's flattened fieldErrors,
// e.g. { password: ["Password must contain at least one uppercase letter"] }).
// Surface the actual field message instead of the generic one so the user
// knows what to fix, not just that something failed.
export function extractErrorMessage(err: unknown, fallback: string): string {
  const data = (err as {
    response?: { data?: { message?: string; errors?: Record<string, string[]> } };
  })?.response?.data;
  const fieldMessages = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  if (fieldMessages.length) return fieldMessages.join(' ');
  return data?.message || fallback;
}
