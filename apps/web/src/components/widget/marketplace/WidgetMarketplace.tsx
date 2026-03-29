"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { WidgetCard } from "./WidgetCard";
import { useDebounce } from "@/lib/use-debounce";
import { Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

export type MarketplaceWidget = Parameters<typeof WidgetCard>[0]["widget"];

type MarketplaceProps = {
  initialWidgets: MarketplaceWidget[];
};

export default function WidgetMarketplace({
  initialWidgets,
}: MarketplaceProps) {
  const t = useTranslations("widgetMarketplace");
  const [widgets, setWidgets] = useState(initialWidgets);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.trim() === "") {
      setWidgets(initialWidgets);
      return;
    }

    const searchWidgets = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/widgets/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: debouncedQuery }),
        });
        const data = await res.json();
        setWidgets(data);
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setLoading(false);
      }
    };

    searchWidgets();
  }, [debouncedQuery, initialWidgets]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2 max-w-xs w-full">
          <div className="relative flex-1">
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
            />

            {/* Right icon: loader | clear */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("clearSearch")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => (
            <WidgetCard key={widget.id} widget={widget} />
          ))}
        </div>
      )}
    </div>
  );
}
