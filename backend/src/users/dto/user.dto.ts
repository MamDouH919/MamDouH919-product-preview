import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsMongoId, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Same rules as signing up, so a staff password is never weaker than a customer-facing one. */
const PASSWORD_RULE = /^(?=.*[0-9])/;
const PASSWORD_MESSAGE = 'Password must contain at least one number';

export class CreateUserDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty()
  @IsMongoId()
  roleId!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({ description: 'false switches the account off and ends its sessions' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minLength: 8, description: 'Sets a new password and ends the user\'s sessions' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password?: string;
}
