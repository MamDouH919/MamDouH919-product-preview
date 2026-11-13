import { Permission } from './dto/role.dto';

/** The role the platform seeds for a store's own super admin. Never shown to the store. */
export const SUPER_ADMIN_ROLE = 'super_admin';
/** The store admin's role: seeded with every permission, so it is never edited or deleted from the dashboard. */
export const ADMIN_ROLE = 'admin';

/**
 * What `requested` asks for that `held` doesn't give, as "action on resource"
 * strings. Empty when `held` covers all of it — the rule behind not letting
 * anyone hand out, or hand to someone else, more than they have themselves.
 */
export function missingPermissions(
  held: readonly Permission[] | undefined,
  requested: readonly Permission[] | undefined,
): string[] {
  const missing: string[] = [];
  for (const permission of requested ?? []) {
    const own = held?.find((p) => p.resource === permission.resource)?.actions ?? [];
    for (const action of permission.actions ?? []) {
      if (!own.includes(action)) missing.push(`${action} on ${permission.resource}`);
    }
  }
  return missing;
}
