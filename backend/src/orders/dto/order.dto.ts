import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, PaymentMethod } from '../enums/order-status.enum';

/**
 * A basket line as the client sends it: what and how many, never a price.
 * Prices are always read from the catalogue on the server.
 */
export class OrderItemInputDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class QuoteOrderDto {
  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;
}

export class CreateOrderDto extends QuoteOrderDto {
  @ApiProperty({ description: "One of the customer's saved addresses" })
  @IsMongoId()
  addressId!: string;

  @ApiProperty({ required: false, enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false, enum: ['en', 'ar'], description: 'Language for order emails' })
  @IsOptional()
  @IsIn(['en', 'ar'])
  locale?: string;
}

/** The delivery address a guest types at checkout. */
export class GuestShippingAddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  street!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  building?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Checkout without signing in: contact email and address instead of an address id. */
export class CreateGuestOrderDto extends QuoteOrderDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: GuestShippingAddressDto })
  @ValidateNested()
  @Type(() => GuestShippingAddressDto)
  shippingAddress!: GuestShippingAddressDto;

  @ApiProperty({ required: false, enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false, enum: ['en', 'ar'], description: 'Language for order emails' })
  @IsOptional()
  @IsIn(['en', 'ar'])
  locale?: string;
}

export class GuestOrderTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/** Turning a guest order into an account, from its confirmation page. */
export class GuestOrderAccountDto extends GuestOrderTokenDto {
  @ApiProperty({ required: false, minimum: 6, description: 'Needed when the account can be claimed directly' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CancelOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryOrdersDto {
  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({
    required: false,
    description: 'Order number, or customer name / phone on the shipping address',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'ISO date, inclusive' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date, inclusive' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 25 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
