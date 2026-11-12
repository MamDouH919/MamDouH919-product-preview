import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { LocalizedFieldDto } from '../../common/dto/localized-field.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateWarehouseDto {
  @ApiProperty({ type: LocalizedFieldDto })
  @ValidateNested()
  @Type(() => LocalizedFieldDto)
  name!: LocalizedFieldDto;

  @ApiProperty({ example: 'RUH', description: 'Letters, digits and dashes; stored upper-case' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{1,12}$/, { message: 'code must be 1–12 letters, digits or dashes' })
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trim)
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiProperty({ required: false, description: 'false closes it; it must hold no stock' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransferLineDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false, description: 'Required when the product has variants' })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateTransferDto {
  @ApiProperty()
  @IsMongoId()
  fromWarehouseId!: string;

  @ApiProperty()
  @IsMongoId()
  toWarehouseId!: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class QueryTransfersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  warehouseId?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiProperty({ required: false, default: 25 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  limit?: number;
}
