import { useAuth } from "@/hooks/useAuth";
import { ProductAccess, hasProductAccess } from "@/types/productAccess";

/**
 * ALE module access gate (mirrors the SQL `has_ale_access(uid)` function):
 *   admin                                            -> always true
 *   specialist with products_enabled bit 4 set       -> true
 *   anyone else                                      -> false
 *
 * Frontend gate only. RLS enforces the same predicate server-side.
 */
export function useAleAccess(): { hasAccess: boolean; isLoading: boolean } {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return { hasAccess: false, isLoading: loading };
  }

  if (profile.role === 'admin') {
    return { hasAccess: true, isLoading: false };
  }

  if (profile.role === 'specialist') {
    return {
      hasAccess: hasProductAccess(profile.products_enabled ?? 0, ProductAccess.ALE),
      isLoading: false,
    };
  }

  return { hasAccess: false, isLoading: false };
}
