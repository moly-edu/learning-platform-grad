import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { getDateTimeLocale } from "@/i18n/config";

async function getWidgets(userId: string) {
  return await prisma.widget.findMany({
    where: { userId },
    include: {
      builds: {
        orderBy: { version: "desc" },
        take: 1,
      },
      _count: {
        select: { builds: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export default async function WidgetsPage() {
  const locale = await getLocale();
  const isVi = locale === "vi";

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");

  const widgets = await getWidgets(session.user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          {isVi ? "Bài tập của bạn" : "Your Widgets"}
        </h1>

        <div className="flex items-center gap-3">
          <Link
            href="/dev/marketplace"
            className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            {isVi ? "Kho bài tập" : "Widget Marketplace"}
          </Link>

          <Link
            href="/dev/dashboard"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isVi ? "Bài tập mới" : "New Widget"}
          </Link>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {isVi ? "Chưa có widget" : "No widgets found"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isVi
              ? "Bắt đầu bằng cách tạo widget đầu tiên"
              : "Start by creating your first widget"}
          </p>
          <Link
            href="/dev/dashboard"
            className="inline-flex px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {isVi ? "Bài tập mới" : "New Widget"}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => {
            const latestBuild = widget.builds[0];
            const statusColors = {
              pending: "bg-yellow-100 text-yellow-800",
              building: "bg-blue-100 text-blue-800",
              success: "bg-green-100 text-green-800",
              failed: "bg-red-100 text-red-800",
            };

            return (
              <Link
                key={widget.id}
                href={`/dev/deploy/${widget.id}`}
                className="block p-6 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground truncate flex-1">
                    {widget.name}
                  </h3>
                  {latestBuild && (
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statusColors[
                          latestBuild.status as keyof typeof statusColors
                        ] || "bg-muted text-foreground"
                      }`}
                    >
                      {latestBuild.status}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span className="truncate">{widget.repoFullName}</span>
                  </div>

                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <span>
                      {isVi ? "Nhánh" : "Branch"}: {widget.branch}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span>
                      {widget._count.builds} {isVi ? "bản build" : "builds"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {isVi ? "Cập nhật" : "Updated"}{" "}
                    {new Date(widget.updatedAt).toLocaleDateString(
                      getDateTimeLocale(locale),
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
