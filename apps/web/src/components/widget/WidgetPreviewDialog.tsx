"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WidgetPreview from "./WidgetPreview";
import { useLocale } from "next-intl";

export default function WidgetPreviewDialog({ html }: { html: string }) {
  const locale = useLocale();
  const isVi = locale === "vi";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{isVi ? "Xem trước" : "Preview"}</Button>
      </DialogTrigger>

      <DialogContent
        className="
          w-[80vw]!
          h-[95vh]!
          max-w-none!
          p-1!
          flex!
          flex-col!
          min-h-0!
        "
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            {isVi ? "Xem trước bài tập" : "Widget Preview"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          <WidgetPreview html={html} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
