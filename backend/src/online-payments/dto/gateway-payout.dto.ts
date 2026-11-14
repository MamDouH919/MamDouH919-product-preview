import { IsDateString, IsMongoId, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

export class RecordPayoutDto {
  @IsDateString()
  date!: string;

  /** What the gateway released before its fees, e.g. "5000.00". */
  @Matches(AMOUNT, { message: 'grossAmount must be an amount with at most 2 decimals' })
  grossAmount!: string;

  /** What it kept, e.g. "75.50". Defaults to none. */
  @IsOptional()
  @Matches(AMOUNT, { message: 'feeAmount must be an amount with at most 2 decimals' })
  feeAmount?: string;

  /** The bank or wallet it landed in; the store's default when left out. */
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReversePayoutDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
