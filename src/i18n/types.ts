export type Locale = "id" | "en";

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: "id", label: "Bahasa Indonesia", short: "ID" },
  { code: "en", label: "English", short: "EN" },
];

export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_STORAGE_KEY = "lod_locale";
