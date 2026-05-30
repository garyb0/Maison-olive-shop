import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PRODUCT_SUBCATEGORY_DEFINITIONS, getSubcategoryDefinition } from "../src/lib/product-subcategories";

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
    subcategorySlug: "croquettes",
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
    subcategorySlug: "harnais",
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
    subcategorySlug: "cordes",
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
    subcategorySlug: "shampoings",
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
    subcategorySlug: "lits",
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

  for (const definition of PRODUCT_SUBCATEGORY_DEFINITIONS) {
    const categoryName = definition.categoryNames.find((name) => categories.some((category) => category.name === name));
    if (!categoryName) continue;

    const category = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) continue;

    await prisma.productSubcategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: category.id,
          slug: definition.slug,
        },
      },
      update: {
        nameFr: definition.nameFr,
        nameEn: definition.nameEn,
      },
      create: {
        categoryId: category.id,
        slug: definition.slug,
        nameFr: definition.nameFr,
        nameEn: definition.nameEn,
      },
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUnique({
      where: { name: product.categoryName },
    });

    if (!category) {
      throw new Error(`Category ${product.categoryName} not found`);
    }

    const subcategoryDefinition = getSubcategoryDefinition(product.categoryName, product.subcategorySlug);
    const subcategory = subcategoryDefinition
      ? await prisma.productSubcategory.findUnique({
          where: {
            categoryId_slug: {
              categoryId: category.id,
              slug: subcategoryDefinition.slug,
            },
          },
        })
      : null;

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
        category: { connect: { id: category.id } },
        subcategory: subcategory ? { connect: { id: subcategory.id } } : undefined,
      },
      create: {
        slug: product.slug,
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        isActive: product.isActive,
        category: { connect: { id: category.id } },
        subcategory: subcategory ? { connect: { id: subcategory.id } } : undefined,
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
