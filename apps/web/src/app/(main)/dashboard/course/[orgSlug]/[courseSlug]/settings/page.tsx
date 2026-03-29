import React from "react";
import { useLocale } from "next-intl";

export default function SettingsPage() {
  const isVi = useLocale() === "vi";

  return <div>{isVi ? "Cài đặt khóa học" : "Course settings"}</div>;
}
