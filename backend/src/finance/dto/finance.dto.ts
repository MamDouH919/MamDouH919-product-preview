import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Custody } from '../schemas/payment.schema';

export class RecordCollectionDto {
  /** A decimal string so no float ever carries money: "315.00". */
  @ApiProperty({ example: '315.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a positive amount with at most 2 decimals' })
  amount!: string;

  @ApiProperty({ enum: Custody })
  @IsEnum(Custody)
  custody!: Custody;

  @ApiProperty({ required: false, description: "Cash box, bank or wallet; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false, description: 'The courier holding it — required when custody is courier' })
  @IsOptional()
  @IsMongoId()
  courierId?: string;

  @ApiProperty({ required: false, description: 'When the customer paid; defaults to now' })
  @IsOptional()
  @IsDateString()
  collectedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VoidCollectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class WriteOffDto {
  @ApiProperty({ required: false, example: '50.00', description: 'Defaults to everything still owed' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be an amount with at most 2 decimals' })
  amount?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class FinanceSummaryQueryDto {
  @ApiProperty({ required: false, example: '2026-10-01', description: 'First day, in the store’s time zone' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiProperty({ required: false, example: '2026-10-31', description: 'Last day, inclusive' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
