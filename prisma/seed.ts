import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Food" },
  { name: "Accessories" },
  { name: "Toys" },
  { name: "Hygiene" },
  { name: "Beds" },
];

const products = [
  {
    slug: "croquettes-premium-bulldog",
    categoryName: "Food",
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
    categoryName: "Accessories",
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
    categoryName: "Toys",
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
    categoryName: "Hygiene",
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
    categoryName: "Beds",
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
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUnique({
      where: { name: product.categoryName },
    });

    if (!category) {
      throw new Error(`Category ${product.categoryName} not found`);
    }

    const { categoryName, ...productData } = product;

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        nameFr: productData.nameFr,
        nameEn: productData.nameEn,
        descriptionFr: productData.descriptionFr,
        descriptionEn: productData.descriptionEn,
        imageUrl: productData.imageUrl,
        priceCents: productData.priceCents,
        currency: productData.currency,
        stock: productData.stock,
        isActive: productData.isActive,
        category: { connect: { id: category.id } },
      },
      create: {
        ...productData,
        category: { connect: { id: category.id } },
      },
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
