import { logApiEvent } from "@/lib/observability";
import {
  formDataToTwilioParams,
  recordSmsStatusCallback,
  validateTwilioRequest,
} from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const params = formDataToTwilioParams(await request.formData());
    if (!validateTwilioRequest(request, params)) {
      logApiEvent({
        level: "WARN",
        route: "/api/twilio/message-status",
        event: "TWILIO_STATUS_INVALID_SIGNATURE",
        status: 403,
      });
      return new Response("Forbidden", { status: 403 });
    }

    await recordSmsStatusCallback(params);
    return new Response(null, { status: 204 });
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "/api/twilio/message-status",
      event: "TWILIO_STATUS_CALLBACK_FAILED",
      status: 500,
      details: { error },
    });
    return new Response("Unable to process callback", { status: 500 });
  }
}
