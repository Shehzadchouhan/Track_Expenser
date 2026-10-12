import { describe, it, expect } from 'vitest';
import {
  toPaise,
  toRupees,
  formatINR,
  sum,
  calculateDerivedBalance,
} from '@/lib/money';

describe('lib/money.ts', () => {
  describe('toPaise() with numbers and float edge cases (rounded to nearest paise)', () => {
    it('rounds float inputs to the nearest paise to tolerate float artifacts', () => {
      // 1.005 in IEEE-754 double precision float is represented as 1.004999999999999893419...
      // Multiplying by 100 yields 100.49999999999999, which Math.round() rounds down to 100 paise.
      expect(toPaise(1.005)).toBe(100);

      // In contrast, 1.006 * 100 = 100.6, rounding up to 101 paise
      expect(toPaise(1.006)).toBe(101);

      // 1.004 * 100 = 100.4, rounding down to 100 paise
      expect(toPaise(1.004)).toBe(100);

      // Classical floating point arithmetic artifact 0.1 + 0.2 = 0.30000000000000004
      // Rounded to the nearest paise gives exactly 30 paise
      expect(toPaise(0.1 + 0.2)).toBe(30);
    });

    it('converts standard float 99.50 to 9950 paise', () => {
      expect(toPaise(99.50)).toBe(9950);
    });

    it('converts small decimals correctly', () => {
      expect(toPaise(0.01)).toBe(1);
      expect(toPaise(0.07)).toBe(7);
      expect(toPaise(0.29)).toBe(29);
      expect(toPaise(100)).toBe(10000);
    });

    it('rejects negative numbers and non-finite values', () => {
      expect(() => toPaise(-5)).toThrow('Amount cannot be negative');
      expect(() => toPaise(Number.NaN)).toThrow('Invalid numeric amount');
      expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow('Invalid numeric amount');
    });

    it('rejects numbers exceeding 10 Billion paise (10 Crore INR)', () => {
      expect(() => toPaise(100_000_001)).toThrow('Amount exceeds maximum limit');
    });
  });

  describe('toPaise() with textual string parsing (strict max 2 decimals)', () => {
    it('strictly parses "0.1" + "0.2" === 30 without floating-point math', () => {
      expect(toPaise('0.1') + toPaise('0.2')).toBe(30);
    });

    it('parses formatted Indian currency strings with commas', () => {
      expect(toPaise('1,250.50')).toBe(125050);
      expect(toPaise('1,00,000.00')).toBe(10000000);
    });

    it('throws error when string has more than 2 decimal places (strict string contract)', () => {
      // String parsing is strict: unlike number 1.005 which rounds, string '1.005' throws
      expect(() => toPaise('1.005')).toThrow('Cannot have more than 2 decimal places');
      expect(() => toPaise('99.999')).toThrow('Cannot have more than 2 decimal places');
      expect(() => toPaise('0.0001')).toThrow('Cannot have more than 2 decimal places');
    });

    it('strips optional currency symbols cleanly', () => {
      expect(toPaise('₹ 250.50')).toBe(25050);
      expect(toPaise('₹100')).toBe(10000);
      expect(toPaise('INR 50.20')).toBe(5020);
      expect(toPaise('Rs. 1,000')).toBe(100000);
      expect(toPaise('$45.99')).toBe(4599);
    });

    it('handles single decimal place strings correctly (padding zero)', () => {
      expect(toPaise('10.5')).toBe(1050);
      expect(toPaise('0.5')).toBe(50);
      expect(toPaise('1.')).toBe(100);
    });

    it('throws on invalid or empty string inputs', () => {
      expect(() => toPaise('')).toThrow('Amount string cannot be empty');
      expect(() => toPaise('   ')).toThrow('Amount string cannot be empty');
      expect(() => toPaise('abc')).toThrow('Invalid currency string');
      expect(() => toPaise('12.34.56')).toThrow('Invalid currency string');
      expect(() => toPaise('-50.00')).toThrow('Amount cannot be negative');
    });

    it('rejects strings exceeding 10 Billion paise', () => {
      expect(() => toPaise('100000000.01')).toThrow('Amount exceeds maximum limit');
    });
  });

  describe('toRupees()', () => {
    it('converts integer paise back to rupee float', () => {
      expect(toRupees(125050)).toBe(1250.5);
      expect(toRupees(30)).toBe(0.3);
      expect(toRupees(10000)).toBe(100);
    });
  });

  describe('formatINR()', () => {
    it('formats zero correctly', () => {
      expect(formatINR(0)).toBe('₹0.00');
      expect(formatINR(0, { showPaise: false })).toBe('₹0');
    });

    it('formats standard rupee amounts with Indian comma grouping', () => {
      expect(formatINR(100)).toBe('₹1.00');
      expect(formatINR(125050)).toBe('₹1,250.50');
      expect(formatINR(10000000)).toBe('₹1,00,000.00'); // 1 Lakh
      expect(formatINR(1000000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });

    it('formats negative paise amounts cleanly', () => {
      expect(formatINR(-5000)).toBe('-₹50.00');
      expect(formatINR(-10000000)).toBe('-₹1,00,000.00');
    });

    it('supports signDisplay: always for positive inflows', () => {
      expect(formatINR(5000, { signDisplay: 'always' })).toBe('+₹50.00');
      expect(formatINR(0, { signDisplay: 'always' })).toBe('₹0.00');
    });

    it('supports showPaise: false for round figures', () => {
      expect(formatINR(50000, { showPaise: false })).toBe('₹500');
      expect(formatINR(10000000, { showPaise: false })).toBe('₹1,00,000');
    });
  });

  describe('sum()', () => {
    it('returns 0 for empty array', () => {
      expect(sum([])).toBe(0);
    });

    it('accurately sums safe integer numbers in paise', () => {
      expect(sum([100, 250, 450])).toBe(800);
      expect(sum([100, 200, 300])).toBe(600);
      expect(sum([10_000, 20_000])).toBe(30000);
    });

    it('rejects non-safe integer floats in paise sum', () => {
      expect(() => sum([10.5])).toThrow('Invalid safe integer paise amount');
    });
  });

  describe('calculateDerivedBalance()', () => {
    it('derives income, expense, and net balance strictly from transactions', () => {
      const transactions = [
        { type: 'income' as const, amount_paise: 500000 }, // ₹5,000
        { type: 'expense' as const, amount_paise: 120000 }, // ₹1,200
        { type: 'expense' as const, amount_paise: 80000 }, // ₹800
        { type: 'income' as const, amount_paise: 200000 }, // ₹2,000
      ];

      const result = calculateDerivedBalance(transactions);
      expect(result.incomePaise).toBe(700000); // ₹7,000
      expect(result.expensePaise).toBe(200000); // ₹2,000
      expect(result.netBalancePaise).toBe(500000); // ₹5,000 net
    });

    it('handles negative net balance when expenses exceed income', () => {
      const transactions = [
        { type: 'income' as const, amount_paise: 10000 },
        { type: 'expense' as const, amount_paise: 50000 },
      ];

      const result = calculateDerivedBalance(transactions);
      expect(result.netBalancePaise).toBe(-40000);
    });

    it('handles empty transaction list returning zero derived balance', () => {
      const result = calculateDerivedBalance([]);
      expect(result.incomePaise).toBe(0);
      expect(result.expensePaise).toBe(0);
      expect(result.netBalancePaise).toBe(0);
    });
  });
});
