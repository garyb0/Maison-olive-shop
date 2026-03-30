import { registerUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = applyRateLimit(request, { namespace: "auth:register", windowMs: 10 * 60_000, max: 10 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    const input = registerSchema.parse(body);
    const user = await registerUser(input);

    return jsonOk({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return jsonError("Email already exists", 409);
    }
    return jsonError("Invalid request", 400);
  }
}
