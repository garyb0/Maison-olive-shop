import { registerUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import { registerRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "auth:register", windowMs: 10 * 60_000, max: 10 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    const { autoLogin, ...input } = registerRequestSchema.parse(body);
    const user = await registerUser(input, autoLogin ? { autoLogin: true } : undefined);

    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return jsonOk(autoLogin ? { ...payload, role: user.role } : payload);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return jsonError("Email already exists", 409);
    }
    return jsonError("Invalid request", 400);
  }
}
