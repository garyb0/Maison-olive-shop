-- CreateTable
CREATE TABLE "ProductSubcategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubcategory_categoryId_slug_key" ON "ProductSubcategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "ProductSubcategory_categoryId_idx" ON "ProductSubcategory"("categoryId");

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "subcategoryId" TEXT REFERENCES "ProductSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");

-- Guided taxonomy
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'harnais', 'Harnais', 'Harnesses', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('accessories', 'accessoires') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'harnais');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'laisses-et-colliers', 'Laisses et colliers', 'Leashes and collars', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('accessories', 'accessoires') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'laisses-et-colliers');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'transport', 'Transport', 'Travel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('accessories', 'accessoires') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'transport');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'gamelles', 'Gamelles', 'Bowls', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('accessories', 'accessoires') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'gamelles');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'accessoires-de-toilettage', 'Accessoires de toilettage', 'Grooming accessories', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('accessories', 'accessoires') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'accessoires-de-toilettage');

INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'croquettes', 'Croquettes', 'Kibble', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('food', 'nourriture') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'croquettes');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'friandises', 'Friandises', 'Treats', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('food', 'nourriture') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'friandises');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'supplements', 'Suppléments', 'Supplements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('food', 'nourriture') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'supplements');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'nourriture-humide', 'Nourriture humide', 'Wet food', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('food', 'nourriture') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'nourriture-humide');

INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'shampoings', 'Shampoings', 'Shampoos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('hygiene', 'hygiène') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'shampoings');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'soins-de-la-peau', 'Soins de la peau', 'Skin care', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('hygiene', 'hygiène') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'soins-de-la-peau');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'soins-dentaires', 'Soins dentaires', 'Dental care', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('hygiene', 'hygiène') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'soins-dentaires');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'lingettes', 'Lingettes', 'Wipes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('hygiene', 'hygiène') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'lingettes');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'entretien', 'Entretien', 'Cleaning', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('hygiene', 'hygiène') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'entretien');

INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'cordes', 'Cordes', 'Ropes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('toys', 'jouets') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'cordes');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'mastication', 'Mastication', 'Chew toys', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('toys', 'jouets') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'mastication');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'interactifs', 'Interactifs', 'Interactive toys', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('toys', 'jouets') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'interactifs');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'peluches', 'Peluches', 'Plush toys', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('toys', 'jouets') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'peluches');

INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'lits', 'Lits', 'Beds', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('beds', 'literie') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'lits');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'coussins', 'Coussins', 'Cushions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('beds', 'literie') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'coussins');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'couvertures', 'Couvertures', 'Blankets', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('beds', 'literie') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'couvertures');
INSERT INTO "ProductSubcategory" ("id", "categoryId", "slug", "nameFr", "nameEn", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", 'tapis', 'Tapis', 'Mats', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Category" WHERE lower("name") IN ('beds', 'literie') AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "categoryId" = "Category"."id" AND "slug" = 'tapis');

-- Existing product backfill
UPDATE "Product" SET "subcategoryId" = (SELECT "id" FROM "ProductSubcategory" WHERE "categoryId" = "Product"."categoryId" AND "slug" = 'croquettes' LIMIT 1) WHERE "slug" = 'croquettes-premium-bulldog' AND "subcategoryId" IS NULL;
UPDATE "Product" SET "subcategoryId" = (SELECT "id" FROM "ProductSubcategory" WHERE "categoryId" = "Product"."categoryId" AND "slug" = 'harnais' LIMIT 1) WHERE "slug" = 'harnais-confort-olive' AND "subcategoryId" IS NULL;
UPDATE "Product" SET "subcategoryId" = (SELECT "id" FROM "ProductSubcategory" WHERE "categoryId" = "Product"."categoryId" AND "slug" = 'cordes' LIMIT 1) WHERE "slug" = 'jouet-corde-resistante' AND "subcategoryId" IS NULL;
UPDATE "Product" SET "subcategoryId" = (SELECT "id" FROM "ProductSubcategory" WHERE "categoryId" = "Product"."categoryId" AND "slug" = 'shampoings' LIMIT 1) WHERE "slug" = 'shampoing-peau-sensible' AND "subcategoryId" IS NULL;
UPDATE "Product" SET "subcategoryId" = (SELECT "id" FROM "ProductSubcategory" WHERE "categoryId" = "Product"."categoryId" AND "slug" = 'lits' LIMIT 1) WHERE "slug" = 'lit-douillet-anti-stress' AND "subcategoryId" IS NULL;
