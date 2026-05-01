import { env } from "@/lib/env";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { buildSupportAiContext } from "@/lib/support";
import type { CurrentUser } from "@/lib/types";
import { z } from "zod";

const SUPPORT_AI_TIMEOUT_MS = 20_000;
const SUPPORT_AI_MAX_MESSAGE_LENGTH = 1_200;
const SUPPORT_AI_MAX_MESSAGES = 24;
const SUPPORT_AI_MAX_OUTPUT_TOKENS = 4_000;
const SUPPORT_AI_ALLOWED_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const postalCodePattern = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi;
const cardLikePattern = /\b(?:\d[ -]*?){13,19}\b/g;
const civicAddressPattern =
  /\b\d{1,6}\s+(?:(?:rue|avenue|av\.?|boulevard|boul\.?|chemin|ch\.?|rang|route|street|st\.?|road|rd\.?|drive|dr\.?)\s+[A-Za-zÀ-ÿ0-9.' -]{2,60}|[A-Za-zÀ-ÿ0-9.' -]{2,50}\s+(?:rue|avenue|av\.?|boulevard|boul\.?|chemin|ch\.?|rang|route|street|st\.?|road|rd\.?|drive|dr\.?))\b[^\n,.]*/gi;

const supportAiSuggestionSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  intent: z.string().trim().min(1).max(160),
  priority: z.enum(SUPPORT_AI_ALLOWED_PRIORITIES),
  tags: z.array(z.string().trim().min(1).max(40)).max(6),
  draftReply: z.string().trim().min(1).max(1_600),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.array(z.string().trim().min(1).max(180)).max(8),
});

export type SupportAiSuggestion = z.infer<typeof supportAiSuggestionSchema> & {
  generatedAt: string;
  model: string;
  provider: "openai";
};

type RawSupportAiContext = Awaited<ReturnType<typeof buildSupportAiContext>>;

export type PrivacySafeSupportAiInput = {
  business: "Chez Olive";
  mode: "admin_suggestion_only";
  locale: "fr-CA";
  launchContext: string;
  guardrails: string[];
  conversation: {
    status: string;
    priority: string;
    tags: string[];
    existingSummary: string | null;
    existingIntent: string | null;
    source: string;
  };
  customer: {
    accountType: "connected" | "guest";
    supportHistoryCount: number;
    linkedOrder: PrivacySafeOrderContext | null;
    recentOrders: PrivacySafeOrderContext[];
  };
  messages: Array<{
    senderType: string;
    content: string;
    createdAt: string | null;
  }>;
};

type PrivacySafeOrderContext = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string | null;
};

type SupportAiProvider = {
  provider: "openai";
  model: string;
  generateSuggestion(input: PrivacySafeSupportAiInput): Promise<SupportAiSuggestion>;
};

const supportAiJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "intent", "priority", "tags", "draftReply", "confidence", "needsHumanReview"],
  properties: {
    summary: { type: "string" },
    intent: { type: "string" },
    priority: { type: "string", enum: SUPPORT_AI_ALLOWED_PRIORITIES },
    tags: { type: "array", items: { type: "string" } },
    draftReply: { type: "string" },
    confidence: { type: "number" },
    needsHumanReview: { type: "array", items: { type: "string" } },
  },
} as const;

const supportAiInstructions = [
  "You are Chez Olive's internal support assistant.",
  "Return JSON only, following the provided schema.",
  "Write the draft reply in warm, professional French for a Quebec customer.",
  "The draftReply must be ready for the admin to edit and send to the customer: do not prefix it with labels like Suggestion, Draft, or IA.",
  "Do not mention AI, automation, or internal review in the customer-facing draftReply.",
  "Use short French tags when possible.",
  "Never claim a refund, delivery date, product availability, or order status unless it appears in the provided context.",
  "Never provide veterinary diagnosis or medical certainty. Suggest checking with a professional for health concerns.",
  "The draft is admin-only and must be reviewed before being sent to the customer.",
  "Chez Olive has online ordering and local delivery first; do not refer to a physical storefront at launch.",
].join("\n");

function normalizeAiTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
    .slice(0, 6)
    .map((tag) => tag.slice(0, 40));
}

export function redactSensitiveSupportText(value: string) {
  return value
    .replace(emailPattern, "[email masque]")
    .replace(phonePattern, "[telephone masque]")
    .replace(postalCodePattern, "[code postal masque]")
    .replace(cardLikePattern, "[numero sensible masque]")
    .replace(civicAddressPattern, "[adresse masquee]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUPPORT_AI_MAX_MESSAGE_LENGTH);
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapOrder(order: RawSupportAiContext["customer"]["context"]["linkedOrder"]): PrivacySafeOrderContext | null {
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: toIsoString(order.createdAt),
  };
}

export function createPrivacySafeSupportAiInput(rawContext: RawSupportAiContext): PrivacySafeSupportAiInput {
  const customerContext = rawContext.customer.context;
  return {
    business: "Chez Olive",
    mode: "admin_suggestion_only",
    locale: "fr-CA",
    launchContext:
      "Chez Olive sert les clients par commande en ligne, livraison locale a Rimouski et accompagnement support. Ne pas parler d'une boutique physique au lancement.",
    guardrails: [
      "Suggestion interne seulement; aucune reponse automatique au client.",
      "Contexte personnel minimise: pas de courriel, telephone, adresse complete ou donnee de paiement.",
      "Verifier humainement les promesses commerciales, remboursements, statuts de commande et conseils sante animale.",
    ],
    conversation: {
      status: rawContext.conversation.status,
      priority: rawContext.conversation.priority,
      tags: rawContext.conversation.tags,
      existingSummary: rawContext.conversation.aiSummary
        ? redactSensitiveSupportText(rawContext.conversation.aiSummary)
        : null,
      existingIntent: rawContext.conversation.aiIntent
        ? redactSensitiveSupportText(rawContext.conversation.aiIntent)
        : null,
      source: rawContext.conversation.source,
    },
    customer: {
      accountType: customerContext.account ? "connected" : "guest",
      supportHistoryCount: customerContext.supportHistoryCount,
      linkedOrder: mapOrder(customerContext.linkedOrder),
      recentOrders: customerContext.recentOrders.slice(0, 3).map(mapOrder).filter(Boolean) as PrivacySafeOrderContext[],
    },
    messages: rawContext.messages.slice(-SUPPORT_AI_MAX_MESSAGES).map((message) => ({
      senderType: message.senderType,
      content: redactSensitiveSupportText(message.content),
      createdAt: toIsoString(message.createdAt),
    })),
  };
}

function extractOpenAiOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    status?: unknown;
    incomplete_details?: { reason?: string } | null;
    output_text?: unknown;
    output?: Array<{
      content?: Array<{ type?: string; text?: string; refusal?: string }>;
    }>;
  };
  if (response.status === "incomplete") {
    throw new Error("SUPPORT_AI_INCOMPLETE");
  }
  if (typeof response.output_text === "string") return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error("SUPPORT_AI_REFUSED");
      }
      if ((content.type === "output_text" || content.type === "text") && content.text) {
        return content.text;
      }
    }
  }
  return "";
}

function parseSupportAiSuggestion(payload: unknown, model: string): SupportAiSuggestion {
  const parsed = supportAiSuggestionSchema.parse(payload);
  return {
    ...parsed,
    tags: normalizeAiTags(parsed.tags),
    generatedAt: new Date().toISOString(),
    model,
    provider: "openai",
  };
}

function getAbortSignal() {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(SUPPORT_AI_TIMEOUT_MS)
    : undefined;
}

class OpenAiSupportAiProvider implements SupportAiProvider {
  provider = "openai" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateSuggestion(input: PrivacySafeSupportAiInput): Promise<SupportAiSuggestion> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: getAbortSignal(),
      body: JSON.stringify({
        model: this.model,
        store: false,
        reasoning: { effort: "low" },
        instructions: supportAiInstructions,
        input: JSON.stringify(input),
        max_output_tokens: SUPPORT_AI_MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: "support_ai_suggestion",
            strict: true,
            schema: supportAiJsonSchema,
          },
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      logApiEvent({
        level: "WARN",
        route: "lib/support-ai",
        event: "SUPPORT_AI_OPENAI_REQUEST_FAILED",
        details: { status: response.status, model: this.model },
      });
      throw new Error("SUPPORT_AI_PROVIDER_FAILED");
    }

    const outputText = extractOpenAiOutputText(data);
    if (!outputText) throw new Error("SUPPORT_AI_EMPTY_OUTPUT");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      throw new Error("SUPPORT_AI_INVALID_OUTPUT");
    }

    return parseSupportAiSuggestion(parsedJson, this.model);
  }
}

function getSupportAiProvider(): SupportAiProvider {
  if (env.supportAiProvider !== "openai") {
    throw new Error("SUPPORT_AI_PROVIDER_UNSUPPORTED");
  }
  return new OpenAiSupportAiProvider(env.openAiApiKey, env.openAiSupportModel);
}

export async function generateSupportAiSuggestion(conversationId: string, admin: CurrentUser) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  if (!env.supportAiEnabled) throw new Error("SUPPORT_AI_DISABLED");
  if (!env.openAiApiKey) throw new Error("SUPPORT_AI_NOT_CONFIGURED");

  const exists = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!exists) throw new Error("CONVERSATION_NOT_FOUND");

  const rawContext = await buildSupportAiContext(conversationId);
  const privacySafeInput = createPrivacySafeSupportAiInput(rawContext);
  const provider = getSupportAiProvider();
  const suggestion = await provider.generateSuggestion(privacySafeInput);

  await prisma.$transaction([
    prisma.supportConversation.update({
      where: { id: conversationId },
      data: {
        aiSummary: suggestion.summary,
        aiIntent: suggestion.intent,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SUPPORT_AI_SUGGESTION_GENERATED",
        entity: "SupportConversation",
        entityId: conversationId,
        metadata: JSON.stringify({
          provider: suggestion.provider,
          model: suggestion.model,
          priority: suggestion.priority,
          tags: suggestion.tags,
          confidence: suggestion.confidence,
        }),
      },
    }),
  ]);

  return suggestion;
}

export function getSupportAiAvailability() {
  return {
    enabled: env.supportAiEnabled,
    configured: Boolean(env.openAiApiKey),
    provider: env.supportAiProvider,
    model: env.openAiSupportModel,
  };
}
