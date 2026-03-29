"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import các component Select của Shadcn
import { api } from "@/lib/api-client";
import { type Role } from "@repo/db";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SearchUser({
  organizationId,
}: {
  organizationId: string;
}) {
  const t = useTranslations("organization.searchUser");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<any | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setFoundUser(null);

    if (value === "") {
      setError(null);
      return;
    }

    const result = z.string().email(t("invalidEmail")).safeParse(value);
    if (!result.success) {
      setError(result.error.errors[0].message);
    } else {
      setError(null);
    }
  };

  const handleSearch = () => {
    if (error || !email) return;

    startTransition(async () => {
      try {
        const res = await api.users.findByEmail({ query: { email } });
        const user = res.status === 200 ? res.body : null;
        setFoundUser(user);

        if (!user) {
          toast.error(t("notFound"));
        }
      } catch (err) {
        toast.error(t("somethingWentWrong"));
      }
    });
  };

  const handleAddUser = async (userId: string, role: Role, orgId: string) => {
    try {
      setIsLoading(true);
      const res = await api.members.addMember({
        body: { organizationId: orgId, userId, role },
      });
      setIsLoading(false);
      if (res.status !== 201) {
        throw new Error((res.body as any).error || "Failed to add member");
      }
      router.refresh();
      toast.success(t("addSuccess", { role }));
    } catch (error: any) {
      setIsLoading(false);
      toast.error(error.message || t("addError"));
    }
  };

  return (
    <Card className="w-full mx-auto">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field data-invalid={!!error}>
          <FieldLabel>{t("emailSearch")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={handleChange}
              placeholder={t("emailPlaceholder")}
            />
            <Button
              type="button"
              onClick={handleSearch}
              disabled={!!error || !email || isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </Field>

        {foundUser && (
          <div className="p-4 border rounded bg-muted animate-in fade-in slide-in-from-bottom-2">
            <p className="font-bold">{foundUser.name}</p>
            <p className="text-sm text-muted-foreground">{foundUser.email}</p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        {foundUser && (
          <div className="flex w-full gap-2">
            {/* Phần chọn Role */}
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role)}
            >
              <SelectTrigger className="w-32.5">
                <SelectValue placeholder={t("rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("admin")}</SelectItem>
                <SelectItem value="member">{t("member")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Nút thêm User */}
            <Button
              className="flex-1"
              onClick={() => handleAddUser(foundUser?.id, role, organizationId)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <UserPlus className="mr-2 size-4" /> {t("addUser")}
                </>
              )}
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
