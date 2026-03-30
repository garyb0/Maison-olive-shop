import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailReplyToken } from "@/lib/support-email";
import { createSupportMessageAsAdmin } from "@/lib/support";
import { logApiEvent } from "@/lib/observability";
import type { CurrentUser } from "@/lib/types";

/**
 * POST /api/support/email-reply
 * 
 * Allows admins to reply to support conversations via email.
 * This endpoint is designed to be used with email forwarding or webhooks.
 * 
 * Usage:
 * 1. Admin receives email notification with a unique reply-to address
 * 2. Admin replies to the email
 * 3. Email is forwarded to this endpoint (via email service webhook)
 * 4. Endpoint validates token and creates message in conversation
 * 
 * For simplicity, this endpoint accepts a token parameter and message content.
 * In production, you would integrate with your email provider's webhook
 * (Resend, SendGrid, etc.) to receive incoming emails.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, content, fromEmail } = body;

    // Validate required fields
    if (!token || !content) {
      return NextResponse.json(
        { error: "Token and content are required" },
        { status: 400 }
      );
    }

    // Verify token
    const tokenData = verifyEmailReplyToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { conversationId, adminId } = tokenData;

    // Get admin user
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Verify the from email matches admin email (additional security)
    if (fromEmail && fromEmail.toLowerCase() !== admin.email.toLowerCase()) {
      logApiEvent({
        level: "WARN",
        route: "api/support/email-reply",
        event: "EMAIL_REPLY_MISMATCH",
        details: { conversationId, fromEmail, adminEmail: admin.email },
      });
      return NextResponse.json(
        { error: "Email mismatch" },
        { status: 403 }
      );
    }

    // Create the message in the conversation
    const currentUser: CurrentUser = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: "ADMIN",
      language: "fr", // Default language for email replies
    };

    const conversation = await createSupportMessageAsAdmin(
      conversationId,
      currentUser,
      content.trim()
    );

    logApiEvent({
      level: "INFO",
      route: "api/support/email-reply",
      event: "EMAIL_REPLY_SUCCESS",
      details: {
        conversationId,
        adminId: admin.id,
        contentLength: content.length,
      },
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        status: conversation.status,
        messageCount: conversation.messages.length,
      },
    });
  } catch (error) {
    console.error("[API] Email reply error:", error);
    logApiEvent({
      level: "ERROR",
      route: "api/support/email-reply",
      event: "EMAIL_REPLY_ERROR",
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/support/email-reply
 * 
 * Simple health check endpoint for email reply functionality.
 * Used to verify the endpoint is accessible.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Email reply endpoint is active",
    documentation: "POST with { token, content, fromEmail } to reply to a conversation",
  });
}