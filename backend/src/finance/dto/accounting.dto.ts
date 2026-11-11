import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccountType, CashFlowActivity } from '../accounts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

export class AccountNameDto {
  @ApiProperty({ example: 'Bank loan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  en!: string;

  @ApiProperty({ example: 'قرض بنكي' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ar!: string;
}

export class CreateLedgerAccountDto {
  @ApiProperty({ example: '2400', description: '4 to 6 digits; the first digit follows the type (1 assets, 2 liabilities, 3 equity, 4 revenue, 5 cost of sales, 6–9 expenses)' })
  @Matches(/^\d{4,6}$/, { message: 'code must be 4 to 6 digits' })
  code!: string;

  @ApiProperty({ type: AccountNameDto })
  @ValidateNested()
  @Type(() => AccountNameDto)
  name!: AccountNameDto;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ enum: CashFlowActivity, required: false })
  @IsOptional()
  @IsEnum(CashFlowActivity)
  cashFlowActivity?: CashFlowActivity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** The code and type of an account are fixed once it exists. */
export class UpdateLedgerAccountDto {
  @ApiProperty({ type: AccountNameDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccountNameDto)
  name?: AccountNameDto;

  @ApiProperty({ enum: CashFlowActivity, required: false })
  @IsOptional()
  @IsEnum(CashFlowActivity)
  cashFlowActivity?: CashFlowActivity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ManualJournalLineDto {
  @ApiProperty({ example: '6100' })
  @IsString()
  @IsNotEmpty()
  account!: string;

  /** A decimal string, so no float ever carries money: "1500.00". One of debit or credit, the other "0" or left out. */
  @ApiProperty({ required: false, example: '1500.00' })
  @IsOptional()
  @Matches(AMOUNT, { message: 'debit must be an amount with at most 2 decimals' })
  debit?: string;

  @ApiProperty({ required: false, example: '0' })
  @IsOptional()
  @Matches(AMOUNT, { message: 'credit must be an amount with at most 2 decimals' })
  credit?: string;

  @ApiProperty({ required: false, description: "On cash lines (1000): the cash box, bank or wallet; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateManualJournalDto {
  @ApiProperty({ example: '2026-11-01', description: 'The day it happened, in the store’s time zone; not in the future' })
  @Matches(DAY, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ example: 'November rent, paid by bank transfer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  memo!: string;

  @ApiProperty({ required: false, description: 'A reference such as an invoice number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ type: [ManualJournalLineDto] })
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @Type(() => ManualJournalLineDto)
  lines!: ManualJournalLineDto[];
}

export class ReverseJournalDto {
  @ApiProperty({ required: false, example: '2026-11-05', description: 'Defaults to the original entry’s day, or today when that day is closed' })
  @IsOptional()
  @Matches(DAY, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class JournalQueryDto {
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @IsOptional()
  @Matches(DAY)
  to?: string;

  @IsOptional()
  @IsString()
  account?: string;

  /** `manual` for entries typed in, or a business source such as `order`, `expense`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  /** Entry number or memo text. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class AccountStatementQueryDto {
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @IsOptional()
  @Matches(DAY)
  to?: string;

  /** Cash only: one cash box, bank or wallet. */
  @IsOptional()
  @IsMongoId()
  moneyAccount?: string;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  lang?: 'en' | 'ar';
}
