export function toProductSku(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

export function isSmokeProductSku(value: string | null | undefined) {
  return value?.trim().toUpperCase().startsWith("SMOKE-") ?? false;
}
