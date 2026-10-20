import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReturnReason, ReturnStatus } from '../schemas/return-request.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReturnItemInputDto {
  @ApiProperty({ description: 'Index of the line in the order' })
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

export class CreateReturnDto {
  @ApiProperty()
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ type: [ReturnItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];

  @ApiProperty({ enum: ReturnReason })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  note?: string;
}

export class ReturnDecisionDto {
  @ApiProperty({ required: false, description: 'Shown to the customer' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  note?: string;
}

export class QueryReturnsDto {
  @ApiProperty({ required: false, enum: ReturnStatus })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @ApiProperty({ required: false, description: 'Return or order number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  search?: string;

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
