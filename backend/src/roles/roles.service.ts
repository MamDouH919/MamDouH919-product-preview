import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from './schemas/role.schema';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/role.dto';
import { User } from '../auth/schemas/user.schema';
import { ADMIN_ROLE, SUPER_ADMIN_ROLE } from './permissions.util';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private RoleModel: Model<Role>,
    @InjectModel(User.name) private UserModel: Model<User>,
  ) {}

  /**
   * The store's own super admin is not the store's to see or touch: its role
   * answers as if it didn't exist, to every caller of the dashboard.
   */
  private readonly visible = { name: { $ne: SUPER_ADMIN_ROLE } };

  async createRole(createRoleDto: CreateRoleDto) {
    const name = createRoleDto.name.trim();
    if (!name) throw new BadRequestException('Role name is required');
    // Compared without case, so "Admin" can't sit beside the built-in "admin".
    const taken = await this.RoleModel.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, 'i') });
    if (taken) {
      throw new ConflictException('Role with this name already exists');
    }
    return this.RoleModel.create({ ...createRoleDto, name });
  }

  /** Every role the store may see, with how many staff accounts hold it. */
  async getAllRoles() {
    const roles = await this.RoleModel.find(this.visible).sort({ name: 1 }).lean();
    const counts = await this.UserModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { isSuper: { $ne: true }, roleId: { $in: roles.map((r) => r._id) } } },
      { $group: { _id: '$roleId', count: { $sum: 1 } } },
    ]);
    const byRole = new Map(counts.map((c) => [String(c._id), c.count]));
    return roles.map((role) => ({
      ...role,
      usersCount: byRole.get(String(role._id)) ?? 0,
      builtIn: role.name === ADMIN_ROLE,
    }));
  }

  /**
   * Any role by id, the super admin's included — for the system's own
   * permission checks, never for answering the dashboard.
   */
  async getRoleForPermissions(id: string) {
    const role = await this.RoleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async getRoleById(id: string) {
    const role = await this.RoleModel.findOne({ _id: id, ...this.visible });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(id: string, updateRoleDto: CreateRoleDto) {
    const current = await this.getRoleById(id);
    this.assertNotBuiltIn(current, 'edited');
    const name = updateRoleDto.name.trim();
    if (!name) throw new BadRequestException('Role name is required');
    const clash = await this.RoleModel.findOne({
      _id: { $ne: current._id },
      name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
    });
    if (clash) throw new ConflictException('Role with this name already exists');

    const role = await this.RoleModel.findByIdAndUpdate(
      current._id,
      { ...updateRoleDto, name },
      { new: true },
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async deleteRole(id: string) {
    const role = await this.getRoleById(id);
    this.assertNotBuiltIn(role, 'deleted');
    const holders = await this.UserModel.countDocuments({ roleId: role._id });
    if (holders) {
      throw new ConflictException(
        `${holders} user${holders === 1 ? '' : 's'} still ${holders === 1 ? 'has' : 'have'} this role. Move them to another role first.`,
      );
    }
    await this.RoleModel.deleteOne({ _id: role._id });
    return { message: 'Role deleted successfully' };
  }

  private assertNotBuiltIn(role: Role, verb: string) {
    if (role.name === ADMIN_ROLE) {
      throw new BadRequestException(`The ${ADMIN_ROLE} role is built in and cannot be ${verb}`);
    }
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
