"use client";

import { authClient } from "@/lib/auth-client";
import { LogOutIcon, Notebook, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { User } from "@repo/api-contract";
import { useTranslations } from "next-intl";

interface UserDropdownProps {
  user: User;
}

export function UserDropdown({ user }: UserDropdownProps) {
  const t = useTranslations("userDropdown");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name}
              width={16}
              height={16}
              className="rounded-full object-cover"
            />
          ) : (
            <UserIcon />
          )}
          <span className="max-w-48 truncate">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon className="size-4" /> <span>Profile</span>
          </Link>
        </DropdownMenuItem> */}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/classes">
            <Notebook className="size-4" /> <span>{t("classes")}</span>
          </Link>
        </DropdownMenuItem>
        {/* <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="size-4" /> <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dev">
            <CreditCard className="size-4" /> <span>Widgets</span>
          </Link>
        </DropdownMenuItem> */}
        {/* {user.role === "admin" && <AdminItem />} */}
        <SignOutItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SignOutItem() {
  const router = useRouter();
  const t = useTranslations("userDropdown");

  async function handleSignOut() {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(error.message || t("somethingWentWrong"));
    } else {
      toast.success(t("signOutSuccess"));
      router.push("/signin");
    }
  }

  return (
    <DropdownMenuItem onClick={handleSignOut}>
      <LogOutIcon className="size-4" /> <span>{t("signOut")}</span>
    </DropdownMenuItem>
  );
}
