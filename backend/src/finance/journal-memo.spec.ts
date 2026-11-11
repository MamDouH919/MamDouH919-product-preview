import { memoText } from './journal-memo';

describe('memoText', () => {
  it('writes a system memo in both languages', () => {
    expect(memoText({ memoKey: 'opening_stock', memoParams: { qty: 23 } })).toEqual({
      en: 'Opening stock value, 23 unit(s)',
      ar: 'قيمة مخزون أول المدة، 23 وحدة',
    });
  });

  it('keeps the English that entries were written with before', () => {
    expect(memoText({ memoKey: 'stock_movement', memoParams: { type: 'adjustment_in', reason: 'count' } })?.en).toBe('Stock adjustment in: count');
    expect(memoText({ memoKey: 'reversal', memoParams: { entry: 7 } })?.en).toBe('Reverses entry #7');
  });

  it('shows staff-typed and older entries as they were stored', () => {
    expect(memoText({ memo: 'Rent' })).toEqual({ en: 'Rent', ar: 'Rent' });
    expect(memoText({})).toBeUndefined();
  });
});
