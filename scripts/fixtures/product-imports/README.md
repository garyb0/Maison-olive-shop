# Product Variant CSV Imports

Use these files as copy/paste sources for the admin product import at
`/admin/products`.

Recommended flow:
1. Open the CSV.
2. Paste it into "Import CSV variantes".
3. Run "Prévisualiser".
4. If there are no errors, run "Importer / mettre à jour".
5. Export inventory after import to confirm stock, SKU, and variant rows.

CLI flow:
```powershell
npx tsx scripts/import-product-variant-csv.ts scripts/fixtures/product-imports/lits-chien-tres-grand-37x30.csv --env=production --dry-run
npx tsx scripts/import-product-variant-csv.ts scripts/fixtures/product-imports/lits-chien-tres-grand-37x30.csv --env=production --apply
```

For V1, leave size fields empty. Size columns stay in the template so future
products can add sizes without changing the import format.
