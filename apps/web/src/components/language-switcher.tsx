"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { locales, localeCookieName } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("localeSwitcher");

  const handleLocaleChange = (value: string) => {
    document.cookie = `${localeCookieName}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={locale} onValueChange={handleLocaleChange}>
        <SelectTrigger className="w-33 h-9" aria-label={t("label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((item) => (
            <SelectItem key={item} value={item}>
              {t(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
