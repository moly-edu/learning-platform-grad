import Link from "next/link";
import Image from "next/image";
import { CreateOrganizationDialog } from "@/components/forms/create-organization-dialog";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import { Building2, ArrowRight, Calendar } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getDateTimeLocale } from "@/i18n/config";

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(getDateTimeLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function Dashboard() {
  const t = await getTranslations("dashboard.home");
  const locale = await getLocale();

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  });

  return (
    <div className="flex flex-col gap-8 py-14 px-4 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <CreateOrganizationDialog />
      </div>

      {/* Org cards */}
      {organizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((organization) => (
            <Link
              key={organization.id}
              href={`/dashboard/organization/${organization.slug}`}
              className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Top row: logo + name */}
              <div className="flex items-center gap-3">
                {organization.logo ? (
                  <Image
                    src={organization.logo}
                    alt={organization.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm">
                    {organization.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(organization.createdAt, locale)}</span>
                  </div>
                </div>
              </div>

              {/* Hover arrow */}
              <div className="flex items-center text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                {t("openOrganization")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
