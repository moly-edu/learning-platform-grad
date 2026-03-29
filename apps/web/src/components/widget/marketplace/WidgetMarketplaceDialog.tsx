"use client";

import { useEffect, useState } from "react";
import WidgetMarketplace from "./WidgetMarketplace";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WidgetMarketplaceDialog() {
  const t = useTranslations("widgetMarketplace");
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWidgets = async () => {
      const res = await fetch("/api/widgets");
      const data = await res.json();
      setWidgets(data);
      setLoading(false);
    };

    loadWidgets();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center pt-15 w-full h-full gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="text-lg">{t("loading")}</span>
      </div>
    );

  return <WidgetMarketplace initialWidgets={widgets} />;
}
