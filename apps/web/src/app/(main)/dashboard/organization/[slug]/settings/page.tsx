import React from "react";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("organization.settings");

  return <div>{t("placeholder")}</div>;
}
