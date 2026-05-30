import { loadEnvConfig } from "@next/env";
import twilio from "twilio";

loadEnvConfig(process.cwd());

async function main() {
  const { env } = await import("../src/lib/env");
  const { normalizeSmsPhoneToE164 } = await import("../src/lib/sms");

  const rawTo = process.env.TWILIO_TEST_TO_NUMBER;
  const to = normalizeSmsPhoneToE164(rawTo);
  const body = "Chez Olive SMS smoke: test transactionnel. STOP pour arreter.";

  if (!rawTo) {
    console.log("SMS smoke ready.");
    console.log(`- SMS_NOTIFICATIONS_ENABLED=${env.smsNotificationsEnabled}`);
    console.log(`- SMS_DRY_RUN=${env.smsDryRun}`);
    console.log("- Set TWILIO_TEST_TO_NUMBER=+14185551234 to test a destination.");
    return;
  }

  if (!to) {
    throw new Error("Invalid TWILIO_TEST_TO_NUMBER. Use a CA/US number such as +14185551234.");
  }

  if (env.smsDryRun) {
    console.log("SMS dry-run smoke.");
    console.log(`- To: ${to}`);
    console.log(`- Body: ${body}`);
    return;
  }

  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioMessagingServiceSid) {
    throw new Error("Twilio SMS config is incomplete. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID.");
  }

  const client = twilio(env.twilioAccountSid, env.twilioAuthToken);
  const message = await client.messages.create({
    messagingServiceSid: env.twilioMessagingServiceSid,
    to,
    body,
    statusCallback: `${env.siteUrl.replace(/\/+$/, "")}/api/twilio/message-status`,
  });

  console.log("SMS smoke sent.");
  console.log(`- To: ${to}`);
  console.log(`- MessageSid: ${message.sid}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
