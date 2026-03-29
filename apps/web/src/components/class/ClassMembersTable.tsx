import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Prisma } from "@repo/db";
import { useTranslations } from "next-intl";

type MemberWithUser = Prisma.ClassMemberGetPayload<{
  include: { user: true };
}>;

interface MembersTableProps {
  members: MemberWithUser[];
}

export default function ClassMembersTable({ members }: MembersTableProps) {
  const t = useTranslations("classes.membersTable");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25">{t("username")}</TableHead>
          <TableHead>{t("email")}</TableHead>
          <TableHead>{t("role")}</TableHead>
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.user.name}</TableCell>
            <TableCell>{member.user.email}</TableCell>
            <TableCell>{member.role}</TableCell>
            <TableCell className="text-right">
              {/* <MembersTableAction memberId={member.id} /> */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
