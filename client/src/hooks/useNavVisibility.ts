import { trpc } from "@/lib/trpc";

// Map nav items to their feature toggle names
const NAV_FEATURE_MAP: Record<string, string> = {
  "/shotcounter": "nav_shotcounter",
  "/events": "nav_events",
  "/dienstleistungen": "nav_dienstleistungen",
  "/sponsors": "nav_sponsors",
};

/**
 * Hook to check if a navigation item is visible based on feature toggles
 * @param href - The href of the navigation item (e.g., "/events")
 * @returns boolean - true if the nav item is enabled/visible
 */
export function useNavVisibility(href: string): boolean {
  const { data: featureToggles = [] } = trpc.features.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const featureName = NAV_FEATURE_MAP[href];
  if (!featureName) return true; // Always visible items (no feature toggle)
  
  const toggle = featureToggles.find(f => f.featureName === featureName);
  return toggle?.isEnabled ?? true; // Default to enabled if not set
}
