import { allocate, formatMinor, MoneyError, mulDiv, parseMoney, percentOf } from './money';

describe('parseMoney', () => {
  it.each([
    ['12.50', 1250],
    ['12.5', 1250],
    [12.5, 1250],
    ['12', 1200],
    ['0', 0],
    ['0.01', 1],
    [' 315.00 ', 31500],
    ['١٢٫٥٠', 1250],
    ['۱۲.۵', 1250],
  ])('reads %p as %p minor units', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['-1', '1.234', '', 'abc', '1e3', '1,000', '+5', String(0.1 + 0.2), 'Infinity'])(
    'refuses %p',
    (input) => {
      expect(() => parseMoney(input)).toThrow(MoneyError);
    },
  );

  it('refuses amounts past the safe integer range', () => {
    expect(() => parseMoney('99999999999999999')).toThrow(MoneyError);
  });

  it('respects a currency with no minor unit', () => {
    expect(parseMoney('15', 0)).toBe(15);
    expect(() => parseMoney('15.5', 0)).toThrow(MoneyError);
  });
});

describe('mulDiv', () => {
  it('rounds half up, away from zero', () => {
    expect(mulDiv(4001, 1, 4)).toBe(1000); // 1000.25
    expect(mulDiv(2001, 1, 2)).toBe(1001); // 1000.5
    expect(mulDiv(-2001, 1, 2)).toBe(-1001);
  });

  it('stays exact when the product passes 2^53', () => {
    expect(mulDiv(9_000_000_000_000, 3_000, 3_000)).toBe(9_000_000_000_000);
  });
});

describe('percentOf', () => {
  it('rounds 15% of 109.99 to 16.50 (example E3)', () => {
    expect(percentOf(10999, 15)).toBe(1650); // 1649.85
  });

  it('handles fractional percentages exactly', () => {
    expect(percentOf(10000, '12.5')).toBe(1250);
    expect(percentOf(30000, 10)).toBe(3000); // example E1
  });
});

describe('allocate', () => {
  it('splits the E3 discount 15.00 / 1.50', () => {
    expect(allocate(1650, [9999, 1000])).toEqual([1500, 150]);
  });

  it('splits the E8 freight 38.10 / 11.90', () => {
    expect(allocate(5000, [80000, 25000])).toEqual([3810, 1190]);
  });

  it('always adds up to the total', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]); // tie → earliest part first
  });

  it('gives zeros for a zero total and refuses all-zero weights', () => {
    expect(allocate(0, [0, 5])).toEqual([0, 0]);
    expect(() => allocate(10, [0, 0])).toThrow(MoneyError);
  });

  it('refuses fractional input', () => {
    expect(() => allocate(10.5, [1])).toThrow(MoneyError);
    expect(() => allocate(10, [1.5])).toThrow(MoneyError);
  });
});

describe('formatMinor', () => {
  it.each([
    [31500, '315.00'],
    [5, '0.05'],
    [0, '0.00'],
    [-13500, '-135.00'],
  ])('formats %p as %p', (minor, expected) => {
    expect(formatMinor(minor)).toBe(expected);
  });
});
