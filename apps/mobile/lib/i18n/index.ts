import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./translations/en";
import vi from "./translations/vi";

export const supportedLocales = ["en", "vi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

function detectInitialLocale(): SupportedLocale {
  const locale = getLocales()[0]?.languageCode?.toLowerCase();
  if (locale === "vi") {
    return "vi";
  }
  return "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: detectInitialLocale(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
