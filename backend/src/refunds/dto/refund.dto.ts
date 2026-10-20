import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
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
import { RefundMethod, RefundReason, RefundStatus } from '../schemas/refund.schema';
import { DeliveryFeeRefundPolicy } from '../../settings/schemas/setting.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const AMOUNT_MESSAGE = 'must be an amount of 0 or more with at most 2 decimals';

export class RefundLineInputDto {
  @ApiProperty({ description: 'Index of the line in the order' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lineIndex!: number;

  @ApiProperty({ description: 'Units coming back; 0 for an allowance on the line' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

/** What a refund is for. Shared by the preview and the request. */
export class RefundBasisDto {
  @ApiProperty()
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ required: false, description: 'The return the goods came back on' })
  @IsOptional()
  @IsMongoId()
  returnId?: string;

  @ApiProperty({ required: false, type: [RefundLineInputDto], description: "Defaults to the return's lines" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RefundLineInputDto)
  lines?: RefundLineInputDto[];

  @ApiProperty({ enum: RefundReason })
  @IsEnum(RefundReason)
  reason!: RefundReason;
}

export class CreateRefundDto extends RefundBasisDto {
  @ApiProperty({ required: false, example: '135.00', description: 'Product part; defaults to the suggested amount' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: `productAmount ${AMOUNT_MESSAGE}` })
  productAmount?: string;

  @ApiProperty({ required: false, example: '0.00', description: 'Delivery-fee part; defaults to what the policy allows' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: `deliveryAmount ${AMOUNT_MESSAGE}` })
  deliveryAmount?: string;

  @ApiProperty({ enum: RefundMethod })
  @IsEnum(RefundMethod)
  method!: RefundMethod;

  @ApiProperty({ required: false, description: "For cash refunds: the cash box, bank or wallet; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false, description: 'The courier who pays it out — required for courier_cash' })
  @IsOptional()
  @IsMongoId()
  courierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  note?: string;
}

export class RefundDecisionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  note?: string;
}

export class ReverseRefundDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(trim)
  reason!: string;
}

export class QueryRefundsDto {
  @ApiProperty({ required: false, enum: RefundStatus })
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  returnId?: string;

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

export class UpdateRefundRulesDto {
  @ApiProperty({ required: false, example: '200.00' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: `autoApproveUpTo ${AMOUNT_MESSAGE}` })
  autoApproveUpTo?: string;

  @ApiProperty({ required: false, example: '2000.00' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: `singleApproverUpTo ${AMOUNT_MESSAGE}` })
  singleApproverUpTo?: string;

  @ApiProperty({ required: false, enum: DeliveryFeeRefundPolicy })
  @IsOptional()
  @IsEnum(DeliveryFeeRefundPolicy)
  deliveryFeeRefund?: DeliveryFeeRefundPolicy;
}
