import { redirect } from "next/navigation";

type ShopAliasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopAliasPage({ searchParams }: ShopAliasPageProps) {
  const query = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  const search = getSearchParam(query.q) ?? getSearchParam(query.search);
  const category = getSearchParam(query.category);

  if (search?.trim()) {
    params.set("q", search.trim());
  }

  if (category?.trim()) {
    params.set("category", category.trim());
  }

  const destinationQuery = params.toString();
  redirect(destinationQuery ? `/boutique?${destinationQuery}` : "/boutique");
}
