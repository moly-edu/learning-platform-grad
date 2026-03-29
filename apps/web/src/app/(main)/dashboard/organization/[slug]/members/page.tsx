"use client";

import MembersTable from "@/components/organization/members-table";
import SearchUser from "@/components/organization/search-user";
import { useOrganization } from "@/components/providers/org-context";
import { useTranslations } from "next-intl";

export default function OrgMembersPage() {
  const t = useTranslations("organization.members");
  const organization = useOrganization();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bold text-2xl">{t("title")}</h1>
      <MembersTable members={organization?.members || []} />
      <SearchUser organizationId={organization?.id || ""} />
    </div>
  );
}
