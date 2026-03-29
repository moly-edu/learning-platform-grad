"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";

export default function MembersTableAction({ memberId }: { memberId: string }) {
  const t = useTranslations("organization.memberAction");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRemoveMember = async () => {
    setIsLoading(true);
    const { data, error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId, // required
    });
    if (error) {
      toast.error(error.code);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    toast.success(t("removeSuccess"));
    router.refresh();
  };

  return (
    <Button
      disabled={isLoading}
      onClick={handleRemoveMember}
      size="sm"
      variant="destructive"
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : t("remove")}
    </Button>
  );
}
