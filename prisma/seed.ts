import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const products = [
  {
    slug: "croquettes-premium-bulldog",
    nameFr: "Croquettes Premium Bulldog",
    nameEn: "Premium Bulldog Kibble",
    descriptionFr: "Croquettes premium pour bulldog français, digestion sensible.",
    descriptionEn: "Premium kibble for French bulldogs, gentle on sensitive digestion.",
    imageUrl: null,
    priceCents: 4599,
    currency: "CAD",
    stock: 40,
    isActive: true,
  },
  {
    slug: "harnais-confort-olive",
    nameFr: "Harnais Confort Olive",
    nameEn: "Olive Comfort Harness",
    descriptionFr: "Harnais respirant et réglable pour promenades quotidiennes.",
    descriptionEn: "Breathable adjustable harness for everyday walks.",
    imageUrl: null,
    priceCents: 3299,
    currency: "CAD",
    stock: 25,
    isActive: true,
  },
  {
    slug: "jouet-corde-resistante",
    nameFr: "Jouet Corde Résistante",
    nameEn: "Durable Rope Toy",
    descriptionFr: "Jouet corde robuste pour mastication et jeux de traction.",
    descriptionEn: "Tough rope toy for chewing and tug games.",
    imageUrl: null,
    priceCents: 1499,
    currency: "CAD",
    stock: 60,
    isActive: true,
  },
  {
    slug: "shampoing-peau-sensible",
    nameFr: "Shampoing Peau Sensible",
    nameEn: "Sensitive Skin Shampoo",
    descriptionFr: "Shampoing doux sans parfum pour peau sensible.",
    descriptionEn: "Gentle fragrance-free shampoo for sensitive skin.",
    imageUrl: null,
    priceCents: 1899,
    currency: "CAD",
    stock: 35,
    isActive: true,
  },
  {
    slug: "lit-douillet-anti-stress",
    nameFr: "Lit Douillet Anti-Stress",
    nameEn: "Calming Cozy Bed",
    descriptionFr: "Lit moelleux anti-stress pour un sommeil profond.",
    descriptionEn: "Soft calming bed for deeper and more restful sleep.",
    imageUrl: null,
    priceCents: 6999,
    currency: "CAD",
    stock: 15,
    isActive: true,
  },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        isActive: product.isActive,
      },
      create: product,
    });
  }

  console.log(`✅ Seed terminé: ${products.length} produits actifs prêts.`);
}

main()
  .catch((error) => {
    console.error("❌ Seed error", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
