import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook to check if the current user has a specific permission
 * @param permissionKey The permission key to check (e.g., "edit_events")
 * @returns boolean - true if user has permission
 */
export function usePermission(permissionKey: string): boolean {
  const { user, isAuthenticated } = useAuth();
  
  // Fetch user's permissions from database
  const { data: userPermissions = [] } = trpc.permissions.getMyPermissions.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
    staleTime: 30 * 1000, // Cache for 30 seconds (shorter for faster permission updates)
    refetchOnMount: true, // Always refetch on component mount
  });

  return useMemo(() => {
    if (!isAuthenticated || !user) {
      return false;
    }

    // Check if permission exists in user's permissions
    return userPermissions.includes(permissionKey);
  }, [isAuthenticated, user, permissionKey, userPermissions]);
}

/**
 * Hook to get all permissions for the current user
 * @returns string[] - Array of permission keys
 */
export function useUserPermissions(): string[] {
  const { user, isAuthenticated } = useAuth();
  
  const { data: userPermissions = [] } = trpc.permissions.getMyPermissions.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  return userPermissions;
}
