import { getCurrentUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { getSupportStateForUser } from "@/lib/support";

export async function GET() {
  const user = await getCurrentUser();
  const state = await getSupportStateForUser(user);
  return jsonOk(state);
}
