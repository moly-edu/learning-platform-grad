"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StudentAssignmentView from "./StudentAssignmentView";
import { useLocale } from "next-intl";

export default function StudentViewAssignmentDialog({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const locale = useLocale();
  const isVi = locale === "vi";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="px-2! py-1! bg-orange-100 text-orange-700 text-xs rounded hover:bg-orange-200">
          <span className="hidden sm:inline">
            {isVi ? "Xem bài tập" : "Show Assignment"}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[90vw]! h-[95vh]! max-w-none! p-1! flex! flex-col! min-h-0!">
        <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle>
            {isVi ? "Xem lại bài tập" : "Review Assignment"}
          </DialogTitle>
        </DialogHeader>

        <StudentAssignmentView assignmentId={assignmentId} />
      </DialogContent>
    </Dialog>
  );
}
