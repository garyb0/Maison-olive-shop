import { getCurrentUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  return jsonOk({ user });
}
