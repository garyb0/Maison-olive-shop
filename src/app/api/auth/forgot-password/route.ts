import { requestPasswordReset } from "@/lib/auth";
import { sendEmail, buildPasswordResetEmailFr, buildPasswordResetEmailEn } from "@/lib/email";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { forgotPasswordSchema } from "@/lib/validators";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rate = applyRateLimit(request, { namespace: "auth:forgot-password", windowMs: 10 * 60_000, max: 10 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    const input = forgotPasswordSchema.parse(body);

    const token = await requestPasswordReset(input.email);

    if (token) {
      // Detect user's language preference to send email in the right language
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { language: true },
      });

      const lang = user?.language === "en" ? "en" : "fr";
      const resetUrl = `${env.siteUrl}/reset-password?token=${token}`;

      const { subject, html } =
        lang === "en"
          ? buildPasswordResetEmailEn(resetUrl)
          : buildPasswordResetEmailFr(resetUrl);

      await sendEmail({ to: input.email.toLowerCase(), subject, html });

      logApiEvent({
        level: "INFO",
        route: "/api/auth/forgot-password",
        event: "PASSWORD_RESET_REQUESTED",
        status: 200,
        details: { email: input.email },
      });
    } else {
      // Email not found — log quietly but return same 200 (don't reveal existence)
      logApiEvent({
        level: "INFO",
        route: "/api/auth/forgot-password",
        event: "PASSWORD_RESET_EMAIL_NOT_FOUND",
        status: 200,
      });
    }

    // Always return 200 so we don't reveal whether the address exists
    return jsonOk({ ok: true });
  } catch (error) {
    logApiEvent({
      level: "ERROR",
      route: "/api/auth/forgot-password",
      event: "PASSWORD_RESET_REQUEST_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Internal server error", 500);
  }
}
