import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ErrorState({
  message = "خطایی در دریافت اطلاعات رخ داد.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw />
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}
