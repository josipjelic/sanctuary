/**
 * Must match `normalizeTopicLabel` in `supabase/functions/_shared/assign-topics.ts`.
 */
export function normalizeTopicLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
