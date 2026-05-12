import * as db from './db';

type UserRole = 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor';

/**
 * Canonical list of permission keys used across the app.
 * `permissions.toggle` validates input against this tuple (A-P1-08) and
 * `initializeDefaultPermissions()` seeds these on first boot.
 */
export const PERMISSION_KEYS = [
  'edit_events',
  'manage_sponsors',
  'manage_goennermitglieder',
  'edit_shotcounter',
  'reset_shotcounter',
  'edit_team',
  'manage_attendance',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// In-memory permission cache per role, invalidated on admin toggle
const permCache = new Map<string, { keys: string[]; exp: number }>();
const PERM_TTL = 5 * 60 * 1000; // 5 minutes

/** Call after any permission toggle to force fresh DB reads */
export function clearPermissionCache() {
  permCache.clear();
}

/**
 * Get all permission keys for a role, with caching.
 * Cache is invalidated whenever an admin changes role permissions.
 */
export async function getUserPermissions(
  userRole: UserRole,
): Promise<string[]> {
  if (userRole === 'visitor') return [];

  const cached = permCache.get(userRole);
  if (cached && cached.exp > Date.now()) return cached.keys;

  const all = await db.getAllPermissions();
  const keys = all.filter(p => p.role === userRole).map(p => p.permissionKey);

  permCache.set(userRole, { keys, exp: Date.now() + PERM_TTL });
  return keys;
}

/**
 * Check if a user has a specific permission based on their role.
 * Uses the cached getUserPermissions result — single DB call per role per TTL window.
 */
export async function hasPermission(
  userRole: UserRole,
  permissionKey: string,
): Promise<boolean> {
  if (userRole === 'visitor') return false;
  const keys = await getUserPermissions(userRole);
  return keys.includes(permissionKey);
}
