import { issue, issueAt, Pool, receive, UnvaluedStockError, unitCost } from './valuation';

const empty: Pool = { qty: 0, valueMinor: 0, lastUnitCostMinor: null };

describe('moving weighted average', () => {
  it('E2 — rounding drains to exactly zero with the stock', () => {
    let pool = receive(empty, 3, 3000).next; // 3 at 10.00
    pool = receive(pool, 1, 1001).next; // 1 at 10.01 → 40.01 for 4
    const costs: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const out = issue(pool, 1);
      costs.push(out.costMinor);
      pool = out.next;
    }
    expect(costs).toEqual([1000, 1000, 1001, 1000]); // 10.0025, 10.0033, 10.005 → half up, last takes the rest
    expect(pool).toMatchObject({ qty: 0, valueMinor: 0 });
  });

  it('section 8 — buy 10 at 100.00 and 10 at 130.00, sell 15: COGS 1,725.00, 575.00 left', () => {
    let pool = receive(empty, 10, 100000).next;
    pool = receive(pool, 10, 130000).next;
    const sold = issue(pool, 15);
    expect(sold.costMinor).toBe(172500);
    expect(sold.next).toMatchObject({ qty: 5, valueMinor: 57500 });
    expect(unitCost(sold.next)).toBe(11500);
  });

  it('costs a shortfall at the last unit cost, then books the difference when stock arrives', () => {
    let pool = receive(empty, 2, 2000).next; // 10.00 each
    const sold = issue(pool, 5); // 2 on hand + 3 short at the estimate
    expect(sold).toMatchObject({ costMinor: 5000, estimated: true });
    pool = sold.next;
    expect(pool).toMatchObject({ qty: -3, valueMinor: -3000 });

    // 5 arrive at 11.00: the 3 short units really cost 33.00, not 30.00.
    const arrived = receive(pool, 5, 5500);
    expect(arrived.varianceMinor).toBe(300);
    expect(arrived.next).toMatchObject({ qty: 2, valueMinor: 2200 });
  });

  it('settles a shortfall in parts when stock comes in short too', () => {
    const pool: Pool = { qty: -3, valueMinor: -3000, lastUnitCostMinor: 1000 };
    const arrived = receive(pool, 2, 2200);
    expect(arrived.varianceMinor).toBe(200);
    expect(arrived.next).toMatchObject({ qty: -1, valueMinor: -1000 });
  });

  it('leaves an unvalued pool unvalued, and refuses to average a cost into uncosted stock', () => {
    const unvalued: Pool = { qty: 4, valueMinor: null, lastUnitCostMinor: null };
    expect(issue(unvalued, 1)).toMatchObject({ costMinor: null, next: { qty: 3, valueMinor: null } });
    expect(() => receive(unvalued, 1, 100)).toThrow(UnvaluedStockError);
  });

  it('starts valuing an empty unvalued pool on its first priced receipt; uncosted short sales take their full cost', () => {
    const soldShort: Pool = { qty: -2, valueMinor: null, lastUnitCostMinor: null };
    const arrived = receive(soldShort, 5, 5000);
    expect(arrived.varianceMinor).toBe(2000); // the 2 sold with no cost now cost 10.00 each
    expect(arrived.next).toMatchObject({ qty: 3, valueMinor: 3000 });
  });

  it('sends goods back at their purchase cost, and an emptied pool reads exactly zero', () => {
    const pool: Pool = { qty: 2, valueMinor: 1999, lastUnitCostMinor: 1000 };
    const back = issueAt(pool, 2, 2000);
    expect(back).toMatchObject({ varianceMinor: -1, next: { qty: 0, valueMinor: 0 } });
  });
});
