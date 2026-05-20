import { ArrayUnique, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Action } from '../enums/action.enum';
import { Resource } from '../enums/resource.enum';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ required: true })
  @IsString()
  name!: string;

  @ApiProperty({ required: true })
  @ValidateNested()
  @Type(() => Permission)
  permissions!: Permission[];
}

export class Permission {
  @ApiProperty({ required: true })
  @IsEnum(Resource)
  resource!: Resource;

  @ApiProperty({ required: true })
  @IsEnum(Action, { each: true })
  @ArrayUnique()
  actions!: Action[];
}