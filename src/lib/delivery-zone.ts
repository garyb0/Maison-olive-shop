const RIMOUSKI_ALLOWED_FSA = [
  "G5L",
  "G5M",
  "G5N",
  "G5J",
  "G5K",
  "G5H",
  "G5A",
  "G5B",
  "G5C",
  "G5E",
  "G0L",
  "G5X",
  "G0J",
] as const;

export function getPostalFsa(postalCode: string) {
  return postalCode.replace(/\s/g, "").toUpperCase().slice(0, 3);
}

export function isRimouskiPostalCode(postalCode: string) {
  const fsa = getPostalFsa(postalCode);
  return RIMOUSKI_ALLOWED_FSA.includes(fsa as (typeof RIMOUSKI_ALLOWED_FSA)[number]);
}

export function isRimouskiDeliveryAddress(input: { postalCode?: string; country?: string }) {
  const country = (input.country ?? "CA").trim().toUpperCase();
  const postalCode = input.postalCode?.trim() ?? "";
  if (!postalCode || country !== "CA") return false;
  return isRimouskiPostalCode(postalCode);
}
