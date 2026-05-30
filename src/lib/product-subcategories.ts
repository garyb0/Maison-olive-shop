import type { Language } from "@/lib/i18n";

export type ProductSubcategoryDefinition = {
  categoryKey: "accessories" | "food" | "hygiene" | "toys" | "beds";
  categoryNames: string[];
  slug: string;
  nameFr: string;
  nameEn: string;
};

const CATEGORY_ALIASES: Record<ProductSubcategoryDefinition["categoryKey"], string[]> = {
  accessories: ["Accessories", "Accessoires"],
  food: ["Food", "Nourriture"],
  hygiene: ["Hygiene", "Hygiène"],
  toys: ["Toys", "Jouets"],
  beds: ["Beds", "Literie"],
};

export const PRODUCT_SUBCATEGORY_DEFINITIONS: ProductSubcategoryDefinition[] = [
  { categoryKey: "accessories", categoryNames: CATEGORY_ALIASES.accessories, slug: "harnais", nameFr: "Harnais", nameEn: "Harnesses" },
  { categoryKey: "accessories", categoryNames: CATEGORY_ALIASES.accessories, slug: "laisses-et-colliers", nameFr: "Laisses et colliers", nameEn: "Leashes and collars" },
  { categoryKey: "accessories", categoryNames: CATEGORY_ALIASES.accessories, slug: "transport", nameFr: "Transport", nameEn: "Travel" },
  { categoryKey: "accessories", categoryNames: CATEGORY_ALIASES.accessories, slug: "gamelles", nameFr: "Gamelles", nameEn: "Bowls" },
  { categoryKey: "accessories", categoryNames: CATEGORY_ALIASES.accessories, slug: "accessoires-de-toilettage", nameFr: "Accessoires de toilettage", nameEn: "Grooming accessories" },
  { categoryKey: "food", categoryNames: CATEGORY_ALIASES.food, slug: "croquettes", nameFr: "Croquettes", nameEn: "Kibble" },
  { categoryKey: "food", categoryNames: CATEGORY_ALIASES.food, slug: "friandises", nameFr: "Friandises", nameEn: "Treats" },
  { categoryKey: "food", categoryNames: CATEGORY_ALIASES.food, slug: "supplements", nameFr: "Suppléments", nameEn: "Supplements" },
  { categoryKey: "food", categoryNames: CATEGORY_ALIASES.food, slug: "nourriture-humide", nameFr: "Nourriture humide", nameEn: "Wet food" },
  { categoryKey: "hygiene", categoryNames: CATEGORY_ALIASES.hygiene, slug: "shampoings", nameFr: "Shampoings", nameEn: "Shampoos" },
  { categoryKey: "hygiene", categoryNames: CATEGORY_ALIASES.hygiene, slug: "soins-de-la-peau", nameFr: "Soins de la peau", nameEn: "Skin care" },
  { categoryKey: "hygiene", categoryNames: CATEGORY_ALIASES.hygiene, slug: "soins-dentaires", nameFr: "Soins dentaires", nameEn: "Dental care" },
  { categoryKey: "hygiene", categoryNames: CATEGORY_ALIASES.hygiene, slug: "lingettes", nameFr: "Lingettes", nameEn: "Wipes" },
  { categoryKey: "hygiene", categoryNames: CATEGORY_ALIASES.hygiene, slug: "entretien", nameFr: "Entretien", nameEn: "Cleaning" },
  { categoryKey: "toys", categoryNames: CATEGORY_ALIASES.toys, slug: "cordes", nameFr: "Cordes", nameEn: "Ropes" },
  { categoryKey: "toys", categoryNames: CATEGORY_ALIASES.toys, slug: "mastication", nameFr: "Mastication", nameEn: "Chew toys" },
  { categoryKey: "toys", categoryNames: CATEGORY_ALIASES.toys, slug: "interactifs", nameFr: "Interactifs", nameEn: "Interactive toys" },
  { categoryKey: "toys", categoryNames: CATEGORY_ALIASES.toys, slug: "peluches", nameFr: "Peluches", nameEn: "Plush toys" },
  { categoryKey: "beds", categoryNames: CATEGORY_ALIASES.beds, slug: "lits", nameFr: "Lits", nameEn: "Beds" },
  { categoryKey: "beds", categoryNames: CATEGORY_ALIASES.beds, slug: "coussins", nameFr: "Coussins", nameEn: "Cushions" },
  { categoryKey: "beds", categoryNames: CATEGORY_ALIASES.beds, slug: "couvertures", nameFr: "Couvertures", nameEn: "Blankets" },
  { categoryKey: "beds", categoryNames: CATEGORY_ALIASES.beds, slug: "tapis", nameFr: "Tapis", nameEn: "Mats" },
];

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function getProductCategoryKey(categoryName: string) {
  const normalized = normalize(categoryName);

  for (const [categoryKey, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === normalized)) {
      return categoryKey as ProductSubcategoryDefinition["categoryKey"];
    }
  }

  return null;
}

export function getSubcategoryDefinitionsForCategory(categoryName: string) {
  const categoryKey = getProductCategoryKey(categoryName);
  if (!categoryKey) return [];

  return PRODUCT_SUBCATEGORY_DEFINITIONS.filter((definition) => definition.categoryKey === categoryKey);
}

export function getSubcategoryDefinition(categoryName: string, slug?: string | null) {
  if (!slug) return null;

  return getSubcategoryDefinitionsForCategory(categoryName).find((definition) => definition.slug === slug) ?? null;
}

export function getProductSubcategoryLabel(
  subcategory: { nameFr?: string | null; nameEn?: string | null } | null | undefined,
  language: Language,
) {
  if (!subcategory) return null;
  return language === "fr" ? subcategory.nameFr ?? subcategory.nameEn ?? null : subcategory.nameEn ?? subcategory.nameFr ?? null;
}
