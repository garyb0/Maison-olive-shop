# Tests Automatisés — Chez Olive Shop 🧪

Ce dossier contient la suite de tests automatisés du projet **Chez-olive-shop**.

## 📋 Sommaire

- [Pourquoi des tests ?](#pourquoi-des-tests-)
- [Technologie utilisée](#technologie-utilisée)
- [Structure des tests](#structure-des-tests)
- [Exécuter les tests](#exécuter-les-tests)
- [Écrire de nouveaux tests](#écrire-de-nouveaux-tests)
- [Bonnes pratiques](#bonnes-pratiques)

---

## Pourquoi des tests ? 🤔

Les tests automatisés permettent de :

- **Détecter les régressions** avant qu'elles n'atteignent la production
- **Valider la logique métier** critique (calculs de taxes, commandes, promotions)
- **Gagner du temps** sur les tests manuels répétitifs
- **Documenter** le comportement attendu du code
- **Faciliter les refactorings** en toute confiance

---

## Technologie utilisée 🛠️

- **[Vitest](https://vitest.dev/)** — Framework de test moderne et rapide, compatible avec l'écosystème Vite
- **[@testing-library/react](https://testing-library.com/react)** — Bibliothèque pour tester les composants React
- **jsdom** — Implémentation légère du DOM pour exécuter les tests dans Node.js

---

## Structure des tests 📁

```
src/tests/
├── README.md           # Ce fichier
├── setup.ts            # Configuration globale (mocks, nettoyages)
├── taxes.test.ts       # Tests des calculs de taxes et livraison
├── format.test.ts      # Tests du formatage devise et dates
└── promo.test.ts       # Tests des codes promotionnels
```

### Détails par fichier

| Fichier | Ce qu'il teste | Pourquoi c'est important |
|---------|---------------|-------------------------|
| `taxes.test.ts` | `computeShipping`, `computeTaxes`, `computeOrderAmounts` | Garantit que les calculs financiers sont exacts (TPS/TVQ, livraison gratuite, etc.) |
| `format.test.ts` | `formatCurrency`, `formatDate` | Vérifie l'affichage correct des prix et dates en FR/EN |
| `promo.test.ts` | `normalizePromoCode`, `isSupportedPromoCode`, `getPromoDiscountCents` | S'assure que les remises sont appliquées correctement |

---

## Executer les tests

### Prérequis

Avoir installé les dépendances du projet :

```bash
npm install
```

### Commandes disponibles

Depuis la **racine du projet** (`C:\Users\Gary\Desktop\Cline\Chez-olive-shop`) :

```bash
# Exécuter tous les tests une fois
npm run test

# Mode surveillance (re-exécute les tests à chaque modification)
npm run test:watch

# Avec rapport de couverture de code (coverage)
npm run test:coverage
```

### Validation par module

```bash
# Authentification / session
npm run test:module:auth

# Fiches chien / QR public
npm run test:module:dogs

# Commandes / livraison
npm run test:module:orders

# Stripe / abonnements / webhooks
npm run test:module:stripe

# Support / email
npm run test:module:support

# Back-office admin
npm run test:module:admin
```

### Exécuter un fichier de test spécifique

```bash
# Uniquement les tests de taxes
npx vitest run src/tests/taxes.test.ts

# Uniquement les tests de formatage
npx vitest run src/tests/format.test.ts

# Uniquement les tests de promotions
npx vitest run src/tests/promo.test.ts
```

### Exécuter un test spécifique

```bash
# Par nom de test (correspondance partielle)
npx vitest run -t "devrait calculer les taxes"
```

### Options utiles

```bash
# Afficher les logs détaillés
npx vitest run --reporter=verbose

# Ne pas effacer l'écran entre les runs (mode watch)
npx vitest --clearScreen=false

# Limiter le nombre de workers (utile pour déboguer)
npx vitest run --pool=forks --poolOptions.forks.singleFork
```

---

## Ecrire de nouveaux tests

### Modèle de base

Créez un fichier `src/tests/mon-module.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// Si vous testez un module qui importe env, moquez-le
vi.mock('@/lib/env', () => ({
  env: {
    taxRate: 0.14975,
    // ... autres valeurs mockées
  },
}));

import { maFonction } from '@/lib/mon-module';

describe('maFonction', () => {
  it('devrait retourner le résultat attendu', () => {
    const result = maFonction(100);
    expect(result).toBe(150);
  });

  it('devrait gérer le cas limite', () => {
    const result = maFonction(0);
    expect(result).toBe(0);
  });
});
```

### Tester une fonction pure (sans dépendances externes)

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/format';

describe('formatCurrency', () => {
  it('devrait formater 10000 cents en "100,00 $"', () => {
    expect(formatCurrency(10000)).toBe('100,00 $');
  });
});
```

### Mock d'un module

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock avant l'import
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait créer un utilisateur', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: '1', email: 'test@test.com' });

    // ... votre test
  });
});
```

---

## Bonnes pratiques 🎯

### 1. Nommage des tests

Utilisez des noms descriptifs en français :

```typescript
// ✅ Bon
it('devrait retourner 0 pour une commande >= 75$', () => { ... });

// ❌ Mauvais
it('test1', () => { ... });
```

### 2. Un test = une assertion principale

Évitez les tests qui vérifient trop de choses :

```typescript
// ✅ Bon — un test par comportement
it('devrait appliquer les frais de livraison pour < 75$', () => { ... });
it('devrait offrir la livraison gratuite pour >= 75$', () => { ... });

// ❌ À éviter
it('devrait tester la livraison', () => {
  expect(computeShipping(5000)).toBe(899);
  expect(computeShipping(7500)).toBe(0);
  expect(computeShipping(10000)).toBe(0);
});
```

### 3. Utiliser `describe` pour grouper

```typescript
describe('computeShipping', () => {
  describe('avec commande >= 75$', () => {
    it('devrait retourner 0', () => { ... });
  });

  describe('avec commande < 75$', () => {
    it('devrait retourner 899', () => { ... });
  });
});
```

### 4. Tester les cas limites

```typescript
it('devrait gérer une valeur de 0', () => { ... });
it('devrait gérer une valeur négative', () => { ... });
it('devrait gérer une valeur très grande', () => { ... });
it('devrait gérer null/undefined', () => { ... });
```

### 5. Isoler les tests

Chaque test doit être indépendant et pouvoir s'exécuter seul :

```typescript
// ✅ Bon — chaque test crée ses propres données
it('test A', () => {
  const data = createTestData();
  expect(fn(data)).toBe(...);
});

it('test B', () => {
  const data = createTestData(); // Nouvelles données, pas de dépendance au test A
  expect(fn(data)).toBe(...);
});
```

### 6. Utiliser `beforeEach` pour le nettoyage

```typescript
describe('mon module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser l'état global si nécessaire
  });
});
```

---

## 🔗 Ressources utiles

- [Documentation Vitest](https://vitest.dev/)
- [Documentation Testing Library](https://testing-library.com/)
- [Cheatsheet Vitest](https://vitest.dev/guide/testing-types)
- [Best Practices Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

## 🆘 Dépannage

### "No test files found"

Vérifiez que vous êtes dans le bon répertoire :

```bash
cd C:\Users\Gary\Desktop\Cline\Chez-olive-shop
npm run test
```

### Tests qui échouent à cause de mocks

Assurez-vous que `vi.mock()` est appelé **avant** l'import du module mocké :

```typescript
// ✅ Bon ordre
vi.mock('@/lib/env', () => ({ ... }));
import { env } from '@/lib/env';

// ❌ Mauvais ordre
import { env } from '@/lib/env';
vi.mock('@/lib/env', () => ({ ... })); // Ne fonctionne pas
```

### Erreurs de chemin d'alias (`@/`)

Vérifiez que `vitest.config.ts` est présent à la racine et que les alias sont bien configurés.

---

**Dernière mise à jour** : 2026-03-30
