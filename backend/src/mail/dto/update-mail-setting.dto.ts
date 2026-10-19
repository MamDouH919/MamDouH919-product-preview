import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MailEncryption } from '../schemas/mail-setting.schema';

export class MailNotificationsDto {
  @IsOptional() @IsBoolean() customerOrderPlaced?: boolean;
  @IsOptional() @IsBoolean() customerOrderStatus?: boolean;
  @IsOptional() @IsBoolean() storeNewOrder?: boolean;
  @IsOptional() @IsBoolean() storeOrderCancelled?: boolean;
  @IsOptional() @IsBoolean() contactForm?: boolean;
}

export class UpdateMailSettingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsEnum(MailEncryption)
  encryption?: MailEncryption;

  @IsOptional()
  @IsBoolean()
  allowInvalidCertificates?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  /** Leave empty to keep the saved password. */
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  password?: string;

  /** Removes the saved password (for servers that need no login). */
  @IsOptional()
  @IsBoolean()
  clearPassword?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsEmail({}, { message: 'replyTo must be an email' })
  replyTo?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  notificationEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bccEmails?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MailNotificationsDto)
  notifications?: MailNotificationsDto;
}

export class TestMailDto extends UpdateMailSettingDto {
  /** Where to send the test; defaults to the sender address. */
  @IsOptional()
  @IsEmail()
  to?: string;
}
