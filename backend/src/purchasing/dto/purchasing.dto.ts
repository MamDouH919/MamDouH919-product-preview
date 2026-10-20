import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
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

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const amountMessage = (field: string) => `${field} must be an amount of 0 or more with at most 2 decimals`;

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class PurchaseLineInputDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @ApiProperty({ example: '40.00', description: 'Price per unit on the invoice' })
  @IsString()
  @Matches(AMOUNT, { message: amountMessage('unitCost') })
  unitCost!: string;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsMongoId()
  supplierId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  supplierInvoiceNo?: string;

  @ApiProperty({ description: 'When the goods were received' })
  @IsDateString()
  date!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ type: [PurchaseLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineInputDto)
  lines!: PurchaseLineInputDto[];

  @ApiProperty({ required: false, example: '50.00', description: 'Freight, customs and other costs of getting the goods in' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: amountMessage('landedCost') })
  landedCost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}

export class PurchaseReturnLineInputDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lineIndex!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty()
  @IsMongoId()
  purchaseId!: string;

  @ApiProperty({ type: [PurchaseReturnLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineInputDto)
  lines!: PurchaseReturnLineInputDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateSupplierPaymentDto {
  @ApiProperty()
  @IsMongoId()
  supplierId!: string;

  @ApiProperty({ example: '500.00' })
  @IsString()
  @Matches(AMOUNT, { message: amountMessage('amount') })
  amount!: string;

  @ApiProperty({ required: false, description: "Paid from which cash box, bank or wallet; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false, description: 'When it was paid; defaults to now' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class QueryPurchasesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiProperty({ required: false, enum: ['draft', 'posted'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SetOpeningCostDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ example: '90.00', description: 'Cost of one unit on the shelf now' })
  @IsString()
  @Matches(AMOUNT, { message: amountMessage('unitCost') })
  unitCost!: string;
}
