import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { EXPENSE_ACCOUNTS } from '../../finance/accounts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateExpenseDto {
  @ApiProperty({ enum: EXPENSE_ACCOUNTS, description: 'The category, as its account code' })
  @IsIn(EXPENSE_ACCOUNTS)
  account!: string;

  @ApiProperty({ example: '3000.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be an amount with at most 2 decimals' })
  amount!: string;

  @ApiProperty({ required: false, description: 'When it was paid; defaults to now' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(trim)
  description!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ required: false, description: "Paid from which cash box, bank or wallet; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false, description: 'The order a delivery cost was for' })
  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  courierId?: string;
}

export class ReverseExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(trim)
  reason!: string;
}

export class QueryExpensesDto {
  @ApiProperty({ required: false, example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiProperty({ required: false, example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiProperty({ required: false, enum: EXPENSE_ACCOUNTS })
  @IsOptional()
  @IsIn(EXPENSE_ACCOUNTS)
  account?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
