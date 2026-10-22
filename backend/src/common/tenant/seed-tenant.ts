import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../../auth/schemas/user.schema';
import { Role, RoleSchema } from '../../roles/schemas/role.schema';
import { Resource } from '../../roles/enums/resource.enum';
import { Action } from '../../roles/enums/action.enum';

export interface SeedUser {
  name: string;
  email: string;
  password: string;
}

export interface SeedOptions {
  admin: SeedUser;
  superAdmin?: SeedUser;
}

/**
 * Gives a store database its `admin` and `super_admin` roles (every permission,
 * refreshed on each run) and creates the admin users that don't exist yet.
 * Safe to run again: an existing user is left as it is. Returns what it did.
 */
export async function seedTenant(connection: Connection, options: SeedOptions): Promise<string[]> {
  const userModel = connection.model(User.name, UserSchema);
  const roleModel = connection.model(Role.name, RoleSchema);
  const log: string[] = [];

  const allPermissions = Object.values(Resource).map((resource) => ({
    resource,
    actions: Object.values(Action),
  }));

  const upsertRole = async (name: string, label: string) => {
    const role = await roleModel.findOneAndUpdate(
      { name },
      { permissions: allPermissions },
      { returnDocument: 'after' },
    );
    if (role) {
      log.push(`${label} role updated with all permissions`);
      return role;
    }
    log.push(`${label} role created`);
    return roleModel.create({ name, permissions: allPermissions });
  };

  const createUser = async (user: SeedUser, roleId: Types.ObjectId, isSuper: boolean, label: string) => {
    if (await userModel.exists({ email: user.email })) {
      log.push(`${label} user already exists (${user.email})`);
      return;
    }
    await userModel.create({
      name: user.name,
      email: user.email,
      password: await bcrypt.hash(user.password, 10),
      isVerified: true,
      isSuper,
      roleId,
    });
    log.push(`${label} user created (${user.email})`);
  };

  const adminRole = await upsertRole('admin', 'Admin');
  const superAdminRole = await upsertRole('super_admin', 'Super Admin');

  await createUser(options.admin, adminRole._id, false, 'Admin');
  if (options.superAdmin) {
    await createUser(options.superAdmin, superAdminRole._id, true, 'Super Admin');
  }

  return log;
}
