ALTER TABLE "PromoBanner" ADD COLUMN "badgeEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "titleEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "price1En" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "price2En" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "point1En" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "point2En" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "point3En" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PromoBanner" ADD COLUMN "ctaTextEn" TEXT NOT NULL DEFAULT '';

UPDATE "PromoBanner"
SET
  "badgeEn" = "badge",
  "titleEn" = "title",
  "price1En" = "price1",
  "price2En" = "price2",
  "point1En" = "point1",
  "point2En" = "point2",
  "point3En" = "point3",
  "ctaTextEn" = "ctaText";
