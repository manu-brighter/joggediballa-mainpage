import * as db from "./db";

/**
 * Check if a user has a specific permission based on their role
 * @param userRole The role of the user
 * @param permissionKey The permission key to check (e.g., "edit_events")
 * @returns Promise<boolean> True if the user has the permission
 */
export async function hasPermission(
  userRole: "admin" | "maintainer" | "editor" | "user" | "visitor",
  permissionKey: string
): Promise<boolean> {
  // Admin always has all permissions
  if (userRole === "admin") {
    return true;
  }

  // Visitor never has any permissions (except public access)
  if (userRole === "visitor") {
    return false;
  }

  // Check database for permission
  const permissions = await db.getAllPermissions();
  return permissions.some(
    (p) => p.permissionKey === permissionKey && p.role === userRole
  );
}

/**
 * Get all permissions for a specific user role
 * @param userRole The role of the user
 * @returns Promise<string[]> Array of permission keys
 */
export async function getUserPermissions(
  userRole: "admin" | "maintainer" | "editor" | "user" | "visitor"
): Promise<string[]> {
  // Admin has all permissions
  if (userRole === "admin") {
    return [
      "edit_events",
      "manage_sponsors",
      "manage_goennermitglieder",
      "edit_shotcounter",
      "reset_shotcounter",
      "edit_team",
    ];
  }

  // Visitor has no permissions
  if (userRole === "visitor") {
    return [];
  }

  // Get permissions from database
  const permissions = await db.getAllPermissions();
  return permissions
    .filter((p) => p.role === userRole)
    .map((p) => p.permissionKey);
}
