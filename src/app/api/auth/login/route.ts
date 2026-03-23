import { loginUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const user = await loginUser(input.email, input.password);

    return jsonOk({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch {
    return jsonError("Invalid credentials", 401);
  }
}
