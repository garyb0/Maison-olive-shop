import { logApiEvent } from "@/lib/observability";
import {
  formDataToTwilioParams,
  recordInboundSms,
  validateTwilioRequest,
} from "@/lib/sms";

export const runtime = "nodejs";

const emptyTwiml = '<Response></Response>';

export async function POST(request: Request) {
  try {
    const params = formDataToTwilioParams(await request.formData());
    if (!validateTwilioRequest(request, params)) {
      logApiEvent({
        level: "WARN",
        route: "/api/twilio/inbound",
        event: "TWILIO_INBOUND_INVALID_SIGNATURE",
        status: 403,
      });
      return new Response("Forbidden", { status: 403 });
    }

    await recordInboundSms(params);
    return new Response(emptyTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "/api/twilio/inbound",
      event: "TWILIO_INBOUND_FAILED",
      status: 500,
      details: { error },
    });
    return new Response("Unable to process inbound SMS", { status: 500 });
  }
}
