import { describe, it, expect } from 'vitest';
import { 
  CHAT_PROMO_CODE, 
  CHAT_PROMO_DISCOUNT_PERCENT, 
  normalizePromoCode, 
  isSupportedPromoCode, 
  getPromoDiscountCents 
} from '@/lib/promo';

describe('normalizePromoCode', () => {
  it('devrait mettre en majuscules', () => {
    expect(normalizePromoCode('olive10')).toBe('OLIVE10');
    expect(normalizePromoCode('Olive10')).toBe('OLIVE10');
  });

  it('devrait supprimer les espaces', () => {
    expect(normalizePromoCode('  OLIVE10  ')).toBe('OLIVE10');
    expect(normalizePromoCode('oli ve10')).toBe('OLIVE10');
  });

  it('devrait retourner une chaîne vide pour null/undefined', () => {
    expect(normalizePromoCode(null)).toBe('');
    expect(normalizePromoCode(undefined)).toBe('');
  });

  it('devrait retourner une chaîne vide pour une chaîne vide', () => {
    expect(normalizePromoCode('')).toBe('');
    expect(normalizePromoCode('   ')).toBe('');
  });
});

describe('isSupportedPromoCode', () => {
  it('devrait accepter le code OLIVE10 exact', () => {
    expect(isSupportedPromoCode('OLIVE10')).toBe(true);
  });

  it('devrait accepter le code en minuscules', () => {
    expect(isSupportedPromoCode('olive10')).toBe(true);
  });

  it('devrait accepter le code avec espaces', () => {
    expect(isSupportedPromoCode('  olive10  ')).toBe(true);
  });

  it('devrait refuser un code inconnu', () => {
    expect(isSupportedPromoCode('INVALID')).toBe(false);
    expect(isSupportedPromoCode('SOLDE20')).toBe(false);
  });

  it('devrait refuser null/undefined/vide', () => {
    expect(isSupportedPromoCode(null)).toBe(false);
    expect(isSupportedPromoCode(undefined)).toBe(false);
    expect(isSupportedPromoCode('')).toBe(false);
  });
});

describe('getPromoDiscountCents', () => {
  it('devrait calculer 10% de remise pour OLIVE10', () => {
    // 10% de 10000 cents = 1000 cents
    expect(getPromoDiscountCents(10000, 'OLIVE10')).toBe(1000);
    
    // 10% de 5000 cents = 500 cents
    expect(getPromoDiscountCents(5000, 'OLIVE10')).toBe(500);
  });

  it('devrait gérer les arrondis correctement', () => {
    // 10% de 999 cents = 99.9 -> 100 cents arrondis
    expect(getPromoDiscountCents(999, 'OLIVE10')).toBe(100);
    
    // 10% de 1 cent = 0.1 -> 0 cents arrondis
    expect(getPromoDiscountCents(1, 'OLIVE10')).toBe(0);
  });

  it('devrait retourner 0 pour un code invalide', () => {
    expect(getPromoDiscountCents(10000, 'INVALID')).toBe(0);
    expect(getPromoDiscountCents(10000, null)).toBe(0);
    expect(getPromoDiscountCents(10000, undefined)).toBe(0);
    expect(getPromoDiscountCents(10000, '')).toBe(0);
  });

  it('devrait retourner 0 pour un montant de 0', () => {
    expect(getPromoDiscountCents(0, 'OLIVE10')).toBe(0);
  });

  it('devrait gérer les grands montants', () => {
    // 10% de 1000000 cents (10 000$) = 100000 cents (1000$)
    expect(getPromoDiscountCents(1000000, 'OLIVE10')).toBe(100000);
  });

  it('devrait être insensible à la casse du code', () => {
    expect(getPromoDiscountCents(10000, 'olive10')).toBe(1000);
    expect(getPromoDiscountCents(10000, 'Olive10')).toBe(1000);
    expect(getPromoDiscountCents(10000, 'OLIVE10')).toBe(1000);
  });
});