import { toProductDto } from '../product-body';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

// The fields shopping feeds read, as the multipart admin form sends them.
describe('merchant fields', () => {
  const base = { 'name[ar]': 'x', category: '6aebb8fa8af6e34c8c417c16' };

  it('reads sale price, brand, barcode and variant attributes', async () => {
    const dto: any = await toProductDto(
      {
        ...base,
        price: '500',
        compareAtPrice: '650',
        brand: 'Acme',
        gtin: '6221234567890',
        variants: JSON.stringify([
          { label: 'red', price: 550, compareAtPrice: '700', color: 'أحمر', size: 'L', gtin: '12345678' },
          { label: 'blue' },
        ]),
      },
      CreateProductDto,
    );
    expect(dto.compareAtPrice).toBe(650);
    expect(dto.variants[0]).toMatchObject({ compareAtPrice: 700, color: 'أحمر', size: 'L', gtin: '12345678' });
    // No price of its own: it sells at the product's, not at 0.
    expect(dto.variants[1].price).toBeUndefined();
  });

  it('clears them when an edit sends them empty', async () => {
    const dto: any = await toProductDto({ compareAtPrice: '', gtin: '', brand: '' }, UpdateProductDto);
    expect(dto.compareAtPrice).toBeNull();
    expect(dto.gtin).toBe('');
  });

  it('rejects a malformed barcode and a negative was-price', async () => {
    await expect(toProductDto({ ...base, gtin: '123' }, CreateProductDto)).rejects.toBeTruthy();
    await expect(toProductDto({ ...base, compareAtPrice: '-5' }, CreateProductDto)).rejects.toBeTruthy();
  });
});
