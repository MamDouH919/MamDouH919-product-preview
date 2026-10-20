import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CourierType } from '../schemas/courier.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const AMOUNT = /^\d+(\.\d{1,2})?$/;

export class CreateCourierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @ApiProperty({ enum: CourierType, required: false })
  @IsOptional()
  @IsEnum(CourierType)
  type?: CourierType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCourierDto extends PartialType(CreateCourierDto) {}

export class SettleCourierDto {
  @ApiProperty()
  @IsMongoId()
  courierId!: string;

  @ApiProperty({ example: '25.00', required: false, description: 'What the courier keeps for delivering' })
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, { message: 'fees must be an amount of 0 or more with at most 2 decimals' })
  fees?: string;

  @ApiProperty({ example: '425.00', description: 'What the courier actually handed over' })
  @IsString()
  @Matches(AMOUNT, { message: 'received must be an amount of 0 or more with at most 2 decimals' })
  received!: string;

  @ApiProperty({ required: false, description: "Where the cash handed over goes; the store's default when left out" })
  @IsOptional()
  @IsMongoId()
  moneyAccountId?: string;

  @ApiProperty({ required: false, description: 'Required when the cash handed over differs from what is expected' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  differenceReason?: string;

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
