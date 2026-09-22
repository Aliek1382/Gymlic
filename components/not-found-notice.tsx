import { SearchX } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * Client-side stand-in for `notFound()`, which needs a server render to
 * produce a 404 and so cannot be used in a statically exported page.
 */
export function NotFoundNotice({
  title = "موردی پیدا نشد",
  description = "چیزی که دنبالش بودید وجود ندارد یا دسترسی به آن ندارید.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-5" />
      </div>
      <div className="space-y-1 px-6">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
