export const formatCurrency = (cents: number, currency = "CAD", locale = "fr-CA") => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
};

export const formatDate = (date: Date | string, locale = "fr-CA") => {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
};
