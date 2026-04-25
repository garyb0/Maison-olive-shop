import { requestPasswordReset } from "@/lib/auth";
import { sendEmail, buildPasswordResetEmailFr, buildPasswordResetEmailEn } from "@/lib/email";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { forgotPasswordSchema } from "@/lib/validators";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolvePublicSiteUrl } from "@/lib/site-url";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "auth:forgot-password", windowMs: 10 * 60_000, max: 10 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      logApiEvent({
        level: "WARN",
        route: "/api/auth/forgot-password",
        event: "PASSWORD_RESET_INVALID_PAYLOAD",
        status: 400,
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
        },
      });
      return jsonError("Invalid request payload", 400);
    }
    const input = parsed.data;

    const token = await requestPasswordReset(input.email);

    let emailStatus = 'sent';
    let resetUrl: string | undefined;
    
    if (token) {
      // Detect user's language preference to send email in the right language
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { language: true },
      });

      const lang = user?.language === "en" ? "en" : "fr";
      
      // Détecter automatiquement l'URL originale depuis la requête (fonctionne avec localhost, IP, domaine, ngrok...)
      const baseUrl = resolvePublicSiteUrl({ request, configuredUrl: env.siteUrl, nodeEnv: env.nodeEnv });
      resetUrl = `${baseUrl}/reset-password?token=${token}`;

      const { subject, html } =
        lang === "en"
          ? buildPasswordResetEmailEn(resetUrl)
          : buildPasswordResetEmailFr(resetUrl);

      try {
        await sendEmail({ to: input.email.toLowerCase(), subject, html });
      } catch (emailError) {
        emailStatus = 'failed';
        logApiEvent({
          level: "WARN",
          route: "/api/auth/forgot-password",
          event: "PASSWORD_RESET_EMAIL_FAILED_SILENT",
          status: 200,
          details: { email: input.email, error: emailError },
        });
      }

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
    return jsonOk({ ok: true, emailStatus, resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined });
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
