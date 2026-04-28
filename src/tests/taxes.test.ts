/// <reference types="vitest/globals" />

// Mock de env.ts avant l'import des fonctions à tester
vi.mock('@/lib/env', () => ({
  env: {
    taxRate: 0.14975, // TPS 5% + TVQ 9.975% = 14.975%
    shippingFlatCents: 899,
    shippingFreeThresholdCents: 7500,
  },
}));

import { computeShipping, computeTaxes, computeOrderAmounts } from '@/lib/taxes';

describe('computeShipping', () => {
  it('devrait retourner 0 pour une commande >= 75$', () => {
    expect(computeShipping(7500)).toBe(0);
    expect(computeShipping(10000)).toBe(0);
    expect(computeShipping(7501)).toBe(0);
  });

  it('devrait retourner les frais de livraison pour une commande < 75$', () => {
    expect(computeShipping(7499)).toBe(899);
    expect(computeShipping(5000)).toBe(899);
    expect(computeShipping(0)).toBe(899);
  });

  it('devrait retourner les frais de livraison pour une commande vide', () => {
    expect(computeShipping(0)).toBe(899);
  });
});

describe('computeTaxes', () => {
  it('devrait calculer les taxes TPS + TVQ (14.975%)', () => {
    // 100$ = TPS 500 + TVQ 997 = 1497 cents apres arrondi par taxe
    expect(computeTaxes(10000)).toBe(1497);
    
    // 50$ = 5000 cents, taxes = 5000 * 0.14975 = 748.75 -> 749 cents arrondis
    expect(computeTaxes(5000)).toBe(749);
    
    // 1 cent, taxes = 0.0014975 -> 0 cents arrondis
    expect(computeTaxes(1)).toBe(0);
  });

  it('devrait retourner 0 pour un montant de 0', () => {
    expect(computeTaxes(0)).toBe(0);
  });

  it('devrait gérer les montants négatifs (bien que non recommandé)', () => {
    expect(computeTaxes(-100)).toBe(-15); // Arrondi
  });
});

describe('computeOrderAmounts', () => {
  it('devrait calculer correctement une commande simple sans remise', () => {
    const result = computeOrderAmounts(7000); // 70$
    
    expect(result.subtotalCents).toBe(7000);
    expect(result.discountCents).toBe(0);
    expect(result.shippingCents).toBe(899); // < 75$ donc frais appliqués
    // Taxes sur (7000 + 899) = 7899 * 0.14975 = 1182.875 -> 1183
    expect(result.taxCents).toBe(1183);
    expect(result.totalCents).toBe(7000 + 899 + 1183); // 9082
  });

  it('devrait calculer correctement une commande avec livraison gratuite', () => {
    const result = computeOrderAmounts(8000); // 80$
    
    expect(result.subtotalCents).toBe(8000);
    expect(result.discountCents).toBe(0);
    expect(result.shippingCents).toBe(0); // >= 75$ donc gratuit
    // Taxes sur 8000 = 8000 * 0.14975 = 1198
    expect(result.taxCents).toBe(1198);
    expect(result.totalCents).toBe(8000 + 0 + 1198); // 9198
  });

  it('devrait calculer correctement une commande avec remise', () => {
    const result = computeOrderAmounts(10000, 2000); // 100$ - 20$ remise
    
    expect(result.subtotalCents).toBe(10000);
    expect(result.discountCents).toBe(2000);
    // Sous-total après remise = 8000, donc livraison gratuite
    expect(result.shippingCents).toBe(0);
    // Taxes sur 8000 = 1198
    expect(result.taxCents).toBe(1198);
    expect(result.totalCents).toBe(8000 + 0 + 1198); // 9198
  });

  it('devrait gérer une remise supérieure au sous-total', () => {
    const result = computeOrderAmounts(5000, 6000); // Remise > sous-total
    
    expect(result.subtotalCents).toBe(5000);
    expect(result.discountCents).toBe(6000);
    // discountedSubtotal devrait être 0 (Math.max(0, ...))
    expect(result.shippingCents).toBe(899); // 0 < 7500 donc frais appliqués
    // Taxes sur (0 + 899) = 899 * 0.14975 = 134.6 -> 135
    expect(result.taxCents).toBe(135);
    expect(result.totalCents).toBe(0 + 899 + 135); // 1034
  });

  it('devrait gérer une commande vide', () => {
    const result = computeOrderAmounts(0);
    
    expect(result.subtotalCents).toBe(0);
    expect(result.discountCents).toBe(0);
    expect(result.shippingCents).toBe(899); // 0 < 7500
    expect(result.taxCents).toBe(135); // 899 * 0.14975 arrondis
    expect(result.totalCents).toBe(1034);
  });

  it('devrait gérer une commande avec remise et frais de livraison', () => {
    // Commande de 80$ avec remise de 10$ -> 70$ (frais de livraison appliqués)
    const result = computeOrderAmounts(8000, 1000);
    
    expect(result.subtotalCents).toBe(8000);
    expect(result.discountCents).toBe(1000);
    // discountedSubtotal = 7000 < 7500 donc frais appliqués
    expect(result.shippingCents).toBe(899);
    // Taxes sur (7000 + 899) = 7899 * 0.14975 = 1182.87 -> 1183
    expect(result.taxCents).toBe(1183);
    expect(result.totalCents).toBe(7000 + 899 + 1183); // 9082
  });
});
