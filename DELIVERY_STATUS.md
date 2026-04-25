# Delivery Status

Date de reference: 2026-04-24

## Resume

Le chantier livraison a ete repris, audite, securise et valide en local.

Etat actuel:
- le smoke livraison local passe de bout en bout
- le build passe
- le module chauffeur peut maintenant partir de la position GPS reelle au clic sur `Demarrer`
- le depot reste un fallback si la position du chauffeur n'est pas disponible

## Valide

Dernieres validations reussies:
- `npm run smoke:delivery`
  - verdict: `PASS (34 checks, 0 warnings, 0 failures)`
- `npx vitest run src/tests/driver-run-route.test.ts src/tests/driver-run-actions-route.test.ts src/tests/delivery-runs-errors.test.ts`
  - verdict: `10 tests`, tous verts
- `npm run build`
  - verdict: vert
- `npm run delivery:preactivate -- --env=development`
  - route planning, GPS, schema et slots dynamiques passent
  - seul warning: le flag experimental est deja a `true` en developpement

## Changements importants

### 1. Smoke et audit

Ajouts principaux:
- `scripts/delivery-smoke.ts`
- `scripts/delivery-preactivate.ts`
- tests admin/chauffeur livraison
- checkpoint/rollback livraison

References:
- [DELIVERY_CHANGE_WORKFLOW.md](C:\Cline\maison-olive-shop\DELIVERY_CHANGE_WORKFLOW.md:1)
- checkpoint: `delivery-checkpoint-20260424-050442-delivery-reprise`
- manifest: [delivery-checkpoint-20260424-050442-delivery-reprise.json](C:\Cline\maison-olive-shop\backups\delivery-checkpoints\delivery-checkpoint-20260424-050442-delivery-reprise.json:1)

### 2. Correctif optimisation tournee

Cause trouvee:
- l'optimisation Google Maps tournait a l'interieur d'une transaction Prisma
- la transaction expirait apres 5 s
- l'erreur etait ensuite mal remappee en faux `schema unavailable`

Correctif:
- calcul Google Maps sorti de la transaction
- mapping d'erreur durci

Fichiers clefs:
- [delivery-runs.ts](C:\Cline\maison-olive-shop\src\lib\delivery-runs.ts:1)
- [delivery-runs-errors.test.ts](C:\Cline\maison-olive-shop\src\tests\delivery-runs-errors.test.ts:1)

### 3. Correctif endpoint chauffeur stop complete

Cause trouvee:
- la route profonde `/api/driver/run/[token]/stops/[stopId]/complete` n'etait pas enregistree proprement par le typegen/routing Next local

Correctif:
- endpoint simplifie en `POST /api/driver/run/[token]/stops/[stopId]`

Fichiers clefs:
- [route.ts](C:\Cline\maison-olive-shop\src\app\api\driver\run\[token]\stops\[stopId]\route.ts:1)
- [run-client.tsx](C:\Cline\maison-olive-shop\src\app\driver\run\[token]\run-client.tsx:1)

### 4. Nouveau comportement depart chauffeur

Demande metier:
- utiliser la vraie position du tech au depart plutot qu'un depot fixe uniquement

Comportement actuel:
- le client chauffeur essaie de recuperer la geolocalisation au clic sur `Demarrer`
- si une position est disponible, elle est envoyee au `start`
- cette position est enregistree comme premier sample GPS
- la tournee est recalcultee depuis cette position reelle
- si la position n'est pas disponible, le systeme retombe sur le depot configure

Fichiers clefs:
- [start route](C:\Cline\maison-olive-shop\src\app\api\driver\run\[token]\start\route.ts:1)
- [validators.ts](C:\Cline\maison-olive-shop\src\lib\validators.ts:1)
- [google-maps.ts](C:\Cline\maison-olive-shop\src\lib\google-maps.ts:1)
- [delivery-runs.ts](C:\Cline\maison-olive-shop\src\lib\delivery-runs.ts:1)

## Attention importante

Le fichier local [`.env.local`](C:\Cline\maison-olive-shop\.env.local:1) contient encore des placeholders depot:

```env
DELIVERY_DEPOT_LINE1="adresse exacte du depot"
DELIVERY_DEPOT_POSTAL="code postal exact"
```

Impact:
- le smoke passe quand meme parce que le depart GPS reel du chauffeur prend le relais
- mais le fallback depot et le retour depot ne sont pas fiables tant que ces placeholders ne sont pas remplaces par la vraie adresse

Adresse depot donnee par l'utilisateur en session:
- `22 Rue de l'Etang`
- `G0L 1B0`

Valeurs recommandees a mettre dans `.env.local`:

```env
DELIVERY_DEPOT_LABEL="Chez Olive"
DELIVERY_DEPOT_LINE1="22 Rue de l'Etang"
DELIVERY_DEPOT_CITY="Rimouski"
DELIVERY_DEPOT_REGION="QC"
DELIVERY_DEPOT_POSTAL="G0L 1B0"
DELIVERY_DEPOT_COUNTRY="CA"
```

## Etat de deploiement

Etat actuel:
- code de livraison deploye sur le service PM2 public `chez-olive-shop`
- `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED="false"` en production
- depot production configure avec `22 Rue de l'Etang`, `G0L 1B0`
- Google Maps configure en production
- migration production `20260423173000_add_delivery_run_tracking` appliquee sur `prod.db`
- backup pre-migration: `backups/pre-delivery-schema-20260424-213527.db`
- dernier release public verifie: `ahYaxF9omdfCTAguluk2w`

Dernieres validations production:
- `npm run build`
  - verdict: vert
- `npm run verify:prod`
  - verdict: ready for production
  - webhook Stripe aligne sur l'app en `2026-02-25.clover`
  - SDK Stripe serveur epingle sur `stripe@20.4.1` pour conserver cette version API
- `npm run delivery:preactivate -- --env=production`
  - verdict: conditionally ready
  - schema livraison, runtime health, slots dynamiques, Google Maps et depot passent
  - warnings attendus tant que le flag prod reste desactive: verification simulee avec flag actif et GPS dormant en runtime stable
- dernier release public verifie apres alignement Stripe: `_5DdEH6nALHcAzi8aMuVz`

Strategie recommandee:
1. garder `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED="false"` en prod
2. surveiller le site apres deploy code
3. preparer un backup/checkpoint immediatement avant activation livraison
4. seulement ensuite envisager une activation livraison en fenetre controlee

## Commandes utiles

Verification preactivation locale:

```powershell
npm run delivery:preactivate -- --env=development
```

Smoke complet local:

```powershell
$env:DELIVERY_SMOKE_ADMIN_EMAIL="..."
$env:DELIVERY_SMOKE_ADMIN_PASSWORD="..."
npm run smoke:delivery
```

Build:

```powershell
npm run build
```

## Fichiers a relire en priorite

- [DELIVERY_STATUS.md](C:\Cline\maison-olive-shop\DELIVERY_STATUS.md:1)
- [DELIVERY_CHANGE_WORKFLOW.md](C:\Cline\maison-olive-shop\DELIVERY_CHANGE_WORKFLOW.md:1)
- [delivery-runs.ts](C:\Cline\maison-olive-shop\src\lib\delivery-runs.ts:1)
- [run-client.tsx](C:\Cline\maison-olive-shop\src\app\driver\run\[token]\run-client.tsx:1)
