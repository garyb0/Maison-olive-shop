# CRITICAL DATA POLICY (FR/EN)

## FR — Règles obligatoires

Ce projet protège en priorité les données critiques suivantes:

- commandes (`Order`, `OrderItem`)
- inventaire (`Product.stock`, `InventoryMovement`)
- utilisateurs et sessions (`User`, `Session`)

Règles à respecter pour toute modification future:

1. **Aucune suppression destructive** des commandes, items de commande, inventaire ou utilisateurs.
2. Toutes les opérations critiques (création commande, ajustement stock, paiement) doivent utiliser des **transactions DB**.
3. Chaque action admin sensible doit être journalisée dans `AuditLog`.
4. Toute migration doit éviter les `DROP TABLE` / `DROP COLUMN` sans plan de sauvegarde explicite.
5. Les données de commande doivent garder un snapshot (prix, nom produit) pour conserver l’historique légal/comptable.

## EN — Mandatory rules

This project prioritizes protection for the following critical data:

- orders (`Order`, `OrderItem`)
- inventory (`Product.stock`, `InventoryMovement`)
- users and sessions (`User`, `Session`)

Rules for every future change:

1. **No destructive deletes** on orders, order items, inventory, or users.
2. Critical operations (order creation, stock updates, payments) must use **database transactions**.
3. Sensitive admin actions must be logged in `AuditLog`.
4. Migrations should avoid `DROP TABLE` / `DROP COLUMN` unless there is an explicit backup plan.
5. Order data must preserve snapshots (price, product name) for legal/accounting history.
