import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto, ProductVariantDto } from './create-product.dto';
import { CreateDeliveryPriceDto, SetZonePriceDto } from '../../price-list/dto/price-list.dto';

const priceErrors = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body))).filter((e) => e.property === 'price');

describe('price validation', () => {
  it.each([
    [CreateProductDto, { name: { en: 'Tea' }, category: '507f1f77bcf86cd799439011' }],
    [ProductVariantDto, { label: 'Large' }],
    [CreateDeliveryPriceDto, { subZoneId: '507f1f77bcf86cd799439011' }],
    [SetZonePriceDto, { zoneId: '507f1f77bcf86cd799439011' }],
  ] as const)('%p takes whole piastres of 0 or more', async (cls, base) => {
    expect(await priceErrors(cls, { ...base, price: 12.5 })).toHaveLength(0);
    expect(await priceErrors(cls, { ...base, price: 0 })).toHaveLength(0);
    expect(await priceErrors(cls, { ...base, price: -1 })).not.toHaveLength(0);
    expect(await priceErrors(cls, { ...base, price: 12.345 })).not.toHaveLength(0);
  });
});
