import { logoutUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function POST() {
  await logoutUser();
  return jsonOk({ ok: true });
}
