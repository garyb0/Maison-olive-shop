import { getActiveProducts } from "@/lib/catalog";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const products = await getActiveProducts();
  return jsonOk({ products });
}
