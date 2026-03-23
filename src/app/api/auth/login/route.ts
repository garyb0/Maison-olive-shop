import { loginUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const user = await loginUser(input.email, input.password);

    logApiEvent({
      level: "INFO",
      route: "/api/auth/login",
      event: "LOGIN_SUCCESS",
      status: 200,
      details: { userId: user.id, role: user.role },
    });

    return jsonOk({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/login",
      event: "LOGIN_FAILED",
      status: 401,
      details: { error },
    });

    return jsonError("Invalid credentials", 401);
  }
}
