import type { Language } from "@/lib/i18n";

type AddressSelectOption = {
  value: string;
  labelFr: string;
  labelEn: string;
};

export const CANADIAN_PROVINCE_OPTIONS: AddressSelectOption[] = [
  { value: "AB", labelFr: "Alberta", labelEn: "Alberta" },
  { value: "BC", labelFr: "Colombie-Britannique", labelEn: "British Columbia" },
  { value: "MB", labelFr: "Manitoba", labelEn: "Manitoba" },
  { value: "NB", labelFr: "Nouveau-Brunswick", labelEn: "New Brunswick" },
  { value: "NL", labelFr: "Terre-Neuve-et-Labrador", labelEn: "Newfoundland and Labrador" },
  { value: "NS", labelFr: "Nouvelle-Écosse", labelEn: "Nova Scotia" },
  { value: "NT", labelFr: "Territoires du Nord-Ouest", labelEn: "Northwest Territories" },
  { value: "NU", labelFr: "Nunavut", labelEn: "Nunavut" },
  { value: "ON", labelFr: "Ontario", labelEn: "Ontario" },
  { value: "PE", labelFr: "Île-du-Prince-Édouard", labelEn: "Prince Edward Island" },
  { value: "QC", labelFr: "Québec", labelEn: "Quebec" },
  { value: "SK", labelFr: "Saskatchewan", labelEn: "Saskatchewan" },
  { value: "YT", labelFr: "Yukon", labelEn: "Yukon" },
];

export const COUNTRY_OPTIONS: AddressSelectOption[] = [
  { value: "CA", labelFr: "Canada", labelEn: "Canada" },
];

const PROVINCE_ALIASES = new Map<string, string>([
  ["AB", "AB"],
  ["ALBERTA", "AB"],
  ["BC", "BC"],
  ["BRITISHCOLUMBIA", "BC"],
  ["COLOMBIEBRITANNIQUE", "BC"],
  ["MB", "MB"],
  ["MANITOBA", "MB"],
  ["NB", "NB"],
  ["NEWBRUNSWICK", "NB"],
  ["NOUVEAUBRUNSWICK", "NB"],
  ["NL", "NL"],
  ["NEWFOUNDLANDANDLABRADOR", "NL"],
  ["TERRENEUVEETLABRADOR", "NL"],
  ["NS", "NS"],
  ["NOVASCOTIA", "NS"],
  ["NOUVELLEECOSSE", "NS"],
  ["NT", "NT"],
  ["NORTHWESTTERRITORIES", "NT"],
  ["TERRITOIRESDUNORDOUEST", "NT"],
  ["NU", "NU"],
  ["NUNAVUT", "NU"],
  ["ON", "ON"],
  ["ONTARIO", "ON"],
  ["PE", "PE"],
  ["PRINCEEDWARDISLAND", "PE"],
  ["ILEDUPRINCEEDOUARD", "PE"],
  ["QC", "QC"],
  ["QUEBEC", "QC"],
  ["QUÉBEC", "QC"],
  ["SK", "SK"],
  ["SASKATCHEWAN", "SK"],
  ["YT", "YT"],
  ["YUKON", "YT"],
]);

const COUNTRY_ALIASES = new Map<string, string>([
  ["CA", "CA"],
  ["CANADA", "CA"],
]);

const normalizeAliasKey = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "");

export const normalizeProvinceCode = (value: string) => {
  const normalized = PROVINCE_ALIASES.get(normalizeAliasKey(value));
  return normalized ?? value.trim().toUpperCase();
};

export const normalizeCountryCode = (value: string) => {
  const normalized = COUNTRY_ALIASES.get(normalizeAliasKey(value));
  return normalized ?? value.trim().toUpperCase();
};

export const normalizePostalCodeInput = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);

export const getAddressOptionLabel = (
  option: AddressSelectOption,
  language: Language,
) => `${option.value} - ${language === "fr" ? option.labelFr : option.labelEn}`;
