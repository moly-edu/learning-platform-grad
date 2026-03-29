"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function OrgNav() {
  const t = useTranslations("organization.nav");
  const pathname = usePathname();
  const params = useParams();

  // Lấy slug từ dynamic route [slug] hoặc [orgSlug]
  // Lưu ý: Tên biến phải khớp với tên thư mục [slug] của bạn
  const slug = params.slug;

  const basePath = `/dashboard/organization/${slug}`;

  // Tối ưu mảng tabs để code ngắn gọn hơn
  const tabs = [
    { name: t("courses"), href: basePath },
    { name: t("members"), href: `${basePath}/members` },
    { name: t("settings"), href: `${basePath}/settings` },
  ];

  return (
    <div className="flex items-center border-b border-border w-full">
      <div className="flex gap-6">
        {tabs.map((tab) => {
          // Kiểm tra active trực tiếp khi render
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative py-2 text-sm font-medium transition-colors hover:text-foreground",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab.name}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-px -left-1 -right-1 h-0.5 bg-foreground"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
