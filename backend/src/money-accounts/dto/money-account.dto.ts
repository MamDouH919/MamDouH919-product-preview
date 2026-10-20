import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MoneyAccountType } from '../schemas/money-account.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMoneyAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  name!: string;

  @ApiProperty({ enum: MoneyAccountType })
  @IsEnum(MoneyAccountType)
  type!: MoneyAccountType;
}

export class UpdateMoneyAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(trim)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Make this the account money goes to when nobody picks one. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class TransferMoneyDto {
  @ApiProperty()
  @IsMongoId()
  fromId!: string;

  @ApiProperty()
  @IsMongoId()
  toId!: string;

  @ApiProperty({ example: '5000.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be an amount with at most 2 decimals' })
  amount!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
