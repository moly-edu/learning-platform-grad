export const locales = ["en", "vi"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "NEXT_LOCALE";

export function isAppLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function getDateTimeLocale(locale: string): string {
  return locale === "vi" ? "vi-VN" : "en-US";
}
