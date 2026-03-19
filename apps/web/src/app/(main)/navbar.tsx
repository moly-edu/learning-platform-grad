// import { ModeToggle } from "@/components/mode-toggle";
import Image from "next/image";
import Link from "next/link";
// import session from "../get-session";
import { UserDropdown } from "@/components/user-dropdown";
import { auth } from "@/lib/auth-server";
import { headers } from "next/headers";
import { ModeToggle } from "@/components/mode-toggle";
import { Sparkles } from "lucide-react";

export async function Navbar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const user = session?.user;

  if (!user) return null;

  return (
    <header className="bg-background border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/dashboard/classes"
          className="flex items-center gap-2 font-semibold"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          Moly
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserDropdown user={user} />
        </div>
      </div>
    </header>
  );
}
