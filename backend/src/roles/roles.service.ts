import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from './schemas/role.schema';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private RoleModel: Model<Role>,
  ) {}

  async createRole(createRoleDto: CreateRoleDto) {
    const existing = await this.RoleModel.findOne({ name: createRoleDto.name });
    if (existing) {
      throw new BadRequestException('Role with this name already exists');
    }
    return this.RoleModel.create(createRoleDto);
  }

  async getAllRoles() {
    return this.RoleModel.find();
  }

  async getRoleById(id: string) {
    const role = await this.RoleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(id: string, updateRoleDto: CreateRoleDto) {
    const role = await this.RoleModel.findByIdAndUpdate(id, updateRoleDto, {
      new: true,
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async deleteRole(id: string) {
    const role = await this.RoleModel.findByIdAndDelete(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return { message: 'Role deleted successfully' };
  }
}
