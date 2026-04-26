# Delivery Status

Date de reference: 2026-04-24

## Resume

Le chantier livraison a ete repris, audite, securise et valide en local.

Etat actuel:
- le smoke livraison local passe de bout en bout
- le build passe
- le module chauffeur peut maintenant partir de la position GPS reelle au clic sur `Demarrer`
- le depot reste un fallback si la position du chauffeur n'est pas disponible
- l'ecran admin des tournees sait maintenant utiliser les commandes a fenetres dynamiques

## Valide

Dernieres validations reussies:
- `npm run smoke:delivery`
  - verdict: `PASS (34 checks, 0 warnings, 0 failures)`
- `npx vitest run src/tests/driver-run-route.test.ts src/tests/driver-run-actions-route.test.ts src/tests/delivery-runs-errors.test.ts`
  - verdict: `10 tests`, tous verts
- `npm run build`
  - verdict: vert
- `npm run test:module:orders`
  - verdict: `12 test files`, `38 tests`, tous verts
- `npm run delivery:preactivate -- --env=development`
  - route planning, GPS, schema et slots dynamiques passent
  - seul warning: le flag experimental est deja a `true` en developpement
- `npm run delivery:preactivate -- --env=production`
  - verdict: `conditionally ready`
  - warnings attendus: flag livraison deja actif en production
- `npm run smoke:delivery`
  - verdict: `WARN (34 checks, 1 warning, 0 failures)`
  - warning attendu: smoke compte client reutilise la session admin locale

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

Le depot est maintenant configure en local et en production avec l'adresse donnee:

```env
DELIVERY_DEPOT_LABEL="Chez Olive"
DELIVERY_DEPOT_LINE1="22 Rue de l'Etang"
DELIVERY_DEPOT_CITY="Rimouski"
DELIVERY_DEPOT_REGION="QC"
DELIVERY_DEPOT_POSTAL="G0L 1B0"
DELIVERY_DEPOT_COUNTRY="CA"
```

Le fallback depot et le retour depot sont donc exploitables si la position GPS chauffeur n'est pas disponible.

## Correctif tournees dynamiques admin

Cause trouvee le 2026-04-24:
- les commandes checkout dynamique etaient bien planifiees via `deliveryWindowStartAt` / `deliveryWindowEndAt`
- elles n'avaient pas de `deliverySlotId`, ce qui est normal en mode dynamique
- l'ecran `/admin/delivery/runs` listait encore seulement les anciens `DeliverySlot`
- la creation de tournee cherchait donc uniquement les commandes rattachees a un slot legacy

Correctif:
- ajout de pseudo-creneaux admin pour les fenetres dynamiques qui ont deja des commandes planifiees
- creation de tournee capable de recevoir un id `dynamic:<start>|<end>`
- au moment de creer la tournee, le systeme cree/reutilise un vrai `DeliverySlot`, rattache les commandes, puis cree les stops
- le libelle du select de tournee affiche maintenant le nombre de commandes planifiees sur le creneau

Validation:
- [delivery-mode.ts](C:\Cline\maison-olive-shop\src\lib\delivery-mode.ts:1)
- [delivery.ts](C:\Cline\maison-olive-shop\src\lib\delivery.ts:1)
- [delivery-runs.ts](C:\Cline\maison-olive-shop\src\lib\delivery-runs.ts:1)
- [delivery-runs-create-dynamic.test.ts](C:\Cline\maison-olive-shop\src\tests\delivery-runs-create-dynamic.test.ts:1)

## Etat de deploiement

Etat actuel:
- code de livraison deploye sur le service PM2 public `chez-olive-shop`
- `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED="true"` en production
- `DELIVERY_GPS_TRACKING_ENABLED="true"` en production
- depot production configure avec `22 Rue de l'Etang`, `G0L 1B0`
- Google Maps configure en production
- migration production `20260423173000_add_delivery_run_tracking` appliquee sur `prod.db`
- backup pre-migration: `backups/pre-delivery-schema-20260424-213527.db`
- backup pre-activation flag: `backups/pre-delivery-flag-on-20260424-223337.db`
- checkpoint pre-activation production: `delivery-checkpoint-20260424-223430-delivery-prod-flag-on`
- backup avant creation des tournees test dynamiques: `backups/delivery-dynamic-runs-before-create-20260424-232850.db`
- dernier release public verifie apres correctif admin: `4tUgyAN2Jt7EbxO5_bO9v`
- PM2 public `chez-olive-shop`: online, PID `71900` apres correction du PID orphelin qui bloquait le port 3101

Dernieres validations production:
- `npm run build`
  - verdict: vert
- `npm run verify:prod`
  - verdict: ready for production
  - webhook Stripe aligne sur l'app en `2026-02-25.clover`
  - SDK Stripe serveur epingle sur `stripe@20.4.1` pour conserver cette version API
- `npm run delivery:preactivate -- --env=production`
  - verdict: conditionally ready
  - schema livraison, runtime health, slots dynamiques, Google Maps, depot et GPS passent
  - warnings attendus car le flag prod est maintenant actif
- sonde publique `https://chezolive.ca/api/delivery/slots?postalCode=G5L%201A1&country=CA`
  - verdict: `status=200 mode=dynamic count=126`
- tournées test creees le 2026-04-24:
  - `cmodsat9o0004b4tq51sxo6yh`: Gary, 2026-04-25 12:00-14:00, commande `MO-20260424-8558`, 1 stop
  - `cmodsat8h0001b4tqzj9vuti5`: Gary, 2026-04-25 16:00-18:00, commande `MO-20260424-7427`, 1 stop

Strategie recommandee:
1. surveiller le site avec livraison dynamique active
2. verifier les premieres commandes livraison reelles
3. verifier la premiere tournee chauffeur avec GPS reel au depart
4. rollback rapide si anomalie: remettre `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED="false"` puis redemarrer PM2

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
