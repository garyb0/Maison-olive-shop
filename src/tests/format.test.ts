/// <reference types="vitest/globals" />
import { formatCurrency, formatDate } from '@/lib/format';

const normalizeSpaces = (value: string) => value.replace(/\u00A0|\u202F/g, ' ');

describe('formatCurrency', () => {
  describe('avec locale fr-CA (défaut)', () => {
    it('devrait formater 10000 cents en 100,00 $ CA', () => {
      expect(normalizeSpaces(formatCurrency(10000))).toBe('100,00 $');
    });

    it('devrait formater 999 cents en 9,99 $ CA', () => {
      expect(normalizeSpaces(formatCurrency(999))).toBe('9,99 $');
    });

    it('devrait formater 0 cents en 0,00 $ CA', () => {
      expect(normalizeSpaces(formatCurrency(0))).toBe('0,00 $');
    });

    it('devrait formater les grands montants avec séparateurs de milliers', () => {
      expect(normalizeSpaces(formatCurrency(1000000))).toBe('10 000,00 $');
    });

    it('devrait gérer les valeurs négatives', () => {
      expect(normalizeSpaces(formatCurrency(-500))).toBe('-5,00 $');
    });
  });

  describe('avec locale en-CA', () => {
    it('devrait formater 10000 cents en $100.00', () => {
      expect(formatCurrency(10000, 'CAD', 'en-CA')).toBe('$100.00');
    });

    it('devrait formater 999 cents en $9.99', () => {
      expect(formatCurrency(999, 'CAD', 'en-CA')).toBe('$9.99');
    });

    it('devrait formater les grands montants avec séparateurs de milliers', () => {
      expect(formatCurrency(1000000, 'CAD', 'en-CA')).toBe('$10,000.00');
    });
  });

  describe('avec différentes devises', () => {
    it('devrait formater en EUR', () => {
      expect(formatCurrency(10000, 'EUR', 'fr-FR')).toContain('100,00');
    });

    it('devrait formater en USD', () => {
      expect(formatCurrency(10000, 'USD', 'en-US')).toBe('$100.00');
    });
  });
});

describe('formatDate', () => {
  describe('avec locale fr-CA (défaut)', () => {
    it('devrait formater une date valide', () => {
      const date = new Date('2024-03-15T14:30:00Z');
      const result = formatDate(date);
      
      // Le format exact dépend du système, mais on vérifie qu'il contient l'année
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });

    it('devrait formater une chaîne ISO', () => {
      const result = formatDate('2024-12-25T00:00:00Z');
      expect(result).toContain('2024');
      expect(/24|25/.test(result)).toBe(true);
    });

    it('devrait inclure l\'heure', () => {
      const date = new Date('2024-03-15T14:30:00Z');
      const result = formatDate(date);
      
      // Devrait contenir une heure (format 24h en fr-CA, varie selon plateforme)
      expect(result).toMatch(/\d{1,2}(?::|\s*h\s*)\d{2}/);
    });
  });

  describe('avec locale en-CA', () => {
    it('devrait formater une date en anglais', () => {
      const date = new Date('2024-03-15T14:30:00Z');
      const result = formatDate(date, 'en-CA');
      
      expect(result).toContain('2024');
      // En anglais, le mois est nommé (Mar, March, etc.)
      expect(result).toMatch(/Mar|March/);
    });
  });

  describe('cas limites', () => {
    it('devrait gérer une date Unix epoch', () => {
      const result = formatDate(new Date(0));
      expect(/1969|1970/.test(result)).toBe(true);
    });

    it('devrait gérer une date future', () => {
      const date = new Date('2099-12-31T23:59:59Z');
      const result = formatDate(date);
      expect(result).toContain('2099');
    });
  });
});