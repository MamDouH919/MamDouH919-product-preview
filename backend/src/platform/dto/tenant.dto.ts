import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StorePlan } from '../../common/tenant/store-plan';

/** A bare hostname: lower-case labels, no port, no scheme. */
const HOST_PATTERN = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const MONGO_URI_PATTERN = /^mongodb(\+srv)?:\/\/\S+$/;
const URL_OPTIONS = { require_tld: false, require_protocol: true, protocols: ['http', 'https'] };

const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTenantDto {
  @ApiProperty({ example: 'shop.example.com' })
  @Transform(lowerTrim)
  @Matches(HOST_PATTERN, { message: 'host must be a bare hostname, e.g. shop.example.com (no port or scheme)' })
  host!: string;

  @ApiProperty({ example: 'mongodb://127.0.0.1:27017/shop-db' })
  @Transform(trim)
  @Matches(MONGO_URI_PATTERN, { message: 'mongoUri must start with mongodb:// or mongodb+srv://' })
  mongoUri!: string;

  @ApiProperty({ example: 'https://shop.example.com' })
  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  frontendUrl!: string;

  @ApiPropertyOptional({ description: 'Primary host this one is a second name for' })
  @IsOptional()
  @Transform(lowerTrim)
  @Matches(HOST_PATTERN)
  aliasOf?: string;

  @ApiPropertyOptional({ enum: StorePlan, description: 'Left out means full. Ignored on an alias, which follows its primary host' })
  @IsOptional()
  @IsEnum(StorePlan)
  plan?: StorePlan;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Left out keeps the current connection string' })
  @IsOptional()
  @Transform(trim)
  @Matches(MONGO_URI_PATTERN, { message: 'mongoUri must start with mongodb:// or mongodb+srv://' })
  mongoUri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsUrl(URL_OPTIONS)
  frontendUrl?: string;

  @ApiPropertyOptional({ description: 'Empty string or null clears it', nullable: true })
  @IsOptional()
  @Transform(lowerTrim)
  @Matches(/^$|^[a-z0-9.-]+$/)
  aliasOf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ enum: StorePlan, description: 'Turning features off hides their data; nothing is deleted' })
  @IsOptional()
  @IsEnum(StorePlan)
  plan?: StorePlan;
}

export class SeedUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class SeedTenantDto {
  @ApiProperty({ type: SeedUserDto })
  @ValidateNested()
  @Type(() => SeedUserDto)
  admin!: SeedUserDto;

  @ApiPropertyOptional({ type: SeedUserDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeedUserDto)
  superAdmin?: SeedUserDto;
}
