import { jsonError, jsonOk } from "@/lib/http";
import { setCurrentLanguage } from "@/lib/language";
import { languageSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = languageSchema.parse(body);
    await setCurrentLanguage(input.language);
    return jsonOk({ language: input.language });
  } catch {
    return jsonError("Invalid language", 400);
  }
}
