import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/schemas/user.schema';
import { RefreshToken } from '../auth/schemas/refresh-schema.schema';
import { Role } from '../roles/schemas/role.schema';
import { Permission } from '../roles/dto/role.dto';
import { missingPermissions, SUPER_ADMIN_ROLE } from '../roles/permissions.util';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface UserView {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  isVerified: boolean;
  role: { _id: string; name: string } | null;
  /** When the account was made, read from its id. */
  createdAt: Date;
}

/**
 * The store's staff accounts. The store's own super admin — the user flagged
 * `isSuper` and whoever holds the super_admin role — is invisible here: it is
 * left out of lists and answers 404 by id, so nothing in this service can
 * read, edit, switch off, delete or hand out its role.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private UserModel: Model<User>,
    @InjectModel(Role.name) private RoleModel: Model<Role>,
    @InjectModel(RefreshToken.name) private RefreshTokenModel: Model<RefreshToken>,
  ) {}

  async list(search?: string): Promise<UserView[]> {
    const superRoleIds = await this.superRoleIds();
    const term = search?.trim();
    const users = await this.UserModel.find({
      ...this.notSuper(superRoleIds),
      ...(term
        ? {
            $or: [
              { name: new RegExp(escapeRegExp(term), 'i') },
              { email: new RegExp(escapeRegExp(term), 'i') },
            ],
          }
        : {}),
    })
      .select('-password')
      .sort({ _id: -1 })
      .lean();
    const roles = await this.rolesById(users.map((u) => u.roleId));
    return users.map((user) => this.view(user, roles));
  }

  async get(id: string): Promise<UserView> {
    const user = await this.findVisible(id);
    return this.view(user.toObject(), await this.rolesById([user.roleId]));
  }

  async create(dto: CreateUserDto, actor: Actor): Promise<UserView> {
    const email = dto.email.trim();
    if (await this.UserModel.exists({ email })) {
      throw new ConflictException('A user with this email already exists');
    }
    const role = await this.assignableRole(dto.roleId, actor);

    const user = await this.UserModel.create({
      name: dto.name.trim(),
      email,
      password: await bcrypt.hash(dto.password, 10),
      // Made by an admin, who vouches for the address: no verification code to send.
      isVerified: true,
      isActive: true,
      isSuper: false,
      roleId: role._id,
    });
    return this.view(user.toObject(), new Map([[String(role._id), role]]));
  }

  async update(id: string, dto: UpdateUserDto, actor: Actor): Promise<UserView> {
    const user = await this.findVisible(id);
    await this.assertCanManage(user, actor);
    const self = String(user._id) === actor.userId;

    if (self && dto.isActive === false) {
      throw new BadRequestException("You can't switch off your own account");
    }
    if (self && dto.roleId !== undefined && dto.roleId !== String(user.roleId)) {
      throw new BadRequestException("You can't change your own role");
    }

    const set: Partial<Pick<User, 'name' | 'email' | 'roleId' | 'isActive' | 'password'>> = {};
    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.email !== undefined && dto.email.trim() !== user.email) {
      const email = dto.email.trim();
      if (await this.UserModel.exists({ email, _id: { $ne: user._id } })) {
        throw new ConflictException('A user with this email already exists');
      }
      set.email = email;
    }
    if (dto.roleId !== undefined && dto.roleId !== String(user.roleId)) {
      set.roleId = (await this.assignableRole(dto.roleId, actor))._id;
    }
    if (dto.isActive !== undefined) set.isActive = dto.isActive;
    if (dto.password !== undefined) set.password = await bcrypt.hash(dto.password, 10);

    if (Object.keys(set).length) {
      await this.UserModel.updateOne({ _id: user._id }, { $set: set });
    }
    // A switched-off account, a new password or a new role takes effect now,
    // not whenever the user's access token happens to expire.
    if (set.isActive === false || set.password !== undefined || set.roleId !== undefined) {
      await this.RefreshTokenModel.deleteMany({ userId: user._id });
    }
    return this.get(id);
  }

  async remove(id: string, actor: Actor) {
    const user = await this.findVisible(id);
    if (String(user._id) === actor.userId) {
      throw new BadRequestException("You can't delete your own account");
    }
    await this.assertCanManage(user, actor);
    await this.RefreshTokenModel.deleteMany({ userId: user._id });
    await this.UserModel.deleteOne({ _id: user._id });
    return { message: 'User deleted successfully' };
  }

  // ── What is hidden ────────────────────────────────────────────────────────

  private async superRoleIds(): Promise<Types.ObjectId[]> {
    const roles = await this.RoleModel.find({ name: SUPER_ADMIN_ROLE }).select('_id').lean();
    return roles.map((r) => r._id as Types.ObjectId);
  }

  private notSuper(superRoleIds: Types.ObjectId[]) {
    return { isSuper: { $ne: true }, roleId: { $nin: superRoleIds } };
  }

  /** The user, or 404 — also for the super admin, which must not be told apart from a missing one. */
  private async findVisible(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const user = await this.UserModel.findOne({
      _id: id,
      ...this.notSuper(await this.superRoleIds()),
    }).select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Who may do what ───────────────────────────────────────────────────────

  /** A role the actor may hand out: it exists, isn't the super admin's, and gives nothing the actor lacks. */
  private async assignableRole(roleId: string, actor: Actor) {
    const role = await this.RoleModel.findOne({ _id: roleId, name: { $ne: SUPER_ADMIN_ROLE } });
    if (!role) throw new BadRequestException('Role not found');
    if (!actor.isSuper) {
      const missing = missingPermissions(actor.permissions, role.permissions as Permission[]);
      if (missing.length) {
        throw new ForbiddenException(`You cannot give this role — it includes ${missing.join(', ')}, which you don't have yourself`);
      }
    }
    return role;
  }

  /** Whoever holds more power than the actor is out of the actor's reach. */
  private async assertCanManage(user: User, actor: Actor) {
    if (actor.isSuper || String(user._id) === actor.userId) return;
    const role = await this.RoleModel.findById(user.roleId).lean();
    const missing = missingPermissions(actor.permissions, role?.permissions as Permission[] | undefined);
    if (missing.length) {
      throw new ForbiddenException("This user has more access than you do, so you can't change their account");
    }
  }

  // ── Shaping ───────────────────────────────────────────────────────────────

  private async rolesById(ids: Array<Types.ObjectId | undefined>) {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    const roles = await this.RoleModel.find({ _id: { $in: unique } }).lean();
    return new Map(roles.map((r) => [String(r._id), r]));
  }

  private view(
    user: { _id: Types.ObjectId; name: string; email: string; isActive?: boolean; isVerified?: boolean; roleId?: Types.ObjectId },
    roles: Map<string, { _id: unknown; name: string }>,
  ): UserView {
    const role = user.roleId ? roles.get(String(user.roleId)) : undefined;
    return {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      isActive: user.isActive !== false,
      isVerified: Boolean(user.isVerified),
      role: role ? { _id: String(role._id), name: role.name } : null,
      createdAt: user._id.getTimestamp(),
    };
  }
}

/** The signed-in admin making the call, with what their role lets them do. */
export interface Actor {
  userId: string;
  isSuper: boolean;
  permissions: Permission[] | undefined;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
