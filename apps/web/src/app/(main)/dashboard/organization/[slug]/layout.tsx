import { OrgNav } from "@/components/organization/organization-nav";
import { OrganizationProvider } from "@/components/providers/org-provider";
import { auth } from "@/lib/auth-server";
import { apiServer } from "@/lib/api-server-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Params = Promise<{ slug: string }>;

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  let organization;
  try {
    const memberRes = await apiServer.members.checkUserInOrg({
      query: { orgSlug: slug },
    });
    if (memberRes.status !== 200 || !memberRes.body) {
      redirect("/dashboard/classes");
    }
    organization = await auth.api.getFullOrganization({
      query: {
        organizationSlug: slug,
        membersLimit: 100,
      },
      headers: await headers(),
    });
  } catch {
    redirect("/dashboard/classes");
  }

  if (!organization) redirect("/dashboard/classes");

  return (
    <OrganizationProvider organization={organization}>
      <div className="flex flex-col gap-4 py-6 px-4 max-w-4xl mx-auto w-full">
        <h1 className="font-bold text-2xl">{organization.name}</h1>
        <OrgNav />
        <div className="mt-2">{children}</div>
      </div>
    </OrganizationProvider>
  );
}
