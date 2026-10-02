"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Library, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { showPlanLimitError } from "@/features/trainer-billing/utils/plan-limit-toast";
import { formatNumber } from "@/lib/persian";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  CONTENT_KINDS,
  copyAllTechniques,
  copyContentItem,
  getContentItem,
  listContentLibrary,
  type ContentItem,
  type ContentKind,
} from "../services/content-library-service";
import { ContentPreview, contentSummary } from "./content-preview";

const QUERY_KEY = ["content-library"] as const;

const TAB_LABEL: Record<ContentKind, string> = {
  workout: "قالب تمرینی",
  nutrition: "قالب غذایی",
  technique: "تکنیک‌ها",
  questionnaire: "پرسشنامه‌ها",
};

/** Where the copy lands, for the toast's link and the "add" button. */
const DESTINATION: Record<ContentKind, { href: string; label: string; add: string }> = {
  workout: { href: "/templates", label: "قالب‌های من", add: "افزودن به قالب‌های من" },
  nutrition: { href: "/templates", label: "قالب‌های من", add: "افزودن به قالب‌های من" },
  // Techniques have no page of their own: they are picked in the workout builder.
  technique: { href: "/workout-programs", label: "تکنیک‌های شما در سازندهٔ برنامه", add: "افزودن به تکنیک‌های من" },
  questionnaire: { href: "/questionnaires", label: "پرسشنامه‌های من", add: "افزودن به پرسشنامه‌های من" },
};

/** /content-library — ready-made content the Gymlic team publishes, for a trainer to copy into their own. */
export function ContentLibraryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: listContentLibrary });
  const [preview, setPreview] = useState<{ kind: ContentKind; item: ContentItem } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function copy(kind: ContentKind, item: ContentItem) {
    setBusy(item.id);
    try {
      await copyContentItem(kind, item.id);
      toast.success(`«${item.title}» به ${DESTINATION[kind].label} اضافه شد.`, {
        action: { label: "دیدن", onClick: () => window.location.assign(DESTINATION[kind].href) },
      });
      // The trainer's own lists now hold the copy.
      void queryClient.invalidateQueries({ queryKey: ["athletes", "templates"] });
      void queryClient.invalidateQueries({ queryKey: ["techniques"] });
      void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
      setPreview(null);
    } catch (error) {
      // A copied template counts against the plan's template cap.
      showPlanLimitError(error, "افزودن ناموفق بود.", { href: "/subscription", navigate: (href) => window.location.assign(href) });
    } finally {
      setBusy(null);
    }
  }

  async function copyAll() {
    setBusy("all");
    try {
      const { added } = await copyAllTechniques();
      toast.success(added > 0 ? `${formatNumber(added)} تکنیک به تکنیک‌های شما اضافه شد.` : "همهٔ این تکنیک‌ها را از قبل دارید.");
      void queryClient.invalidateQueries({ queryKey: ["techniques"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن ناموفق بود."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">محتوای آماده</h1>
          <p className="text-sm text-muted-foreground">
            قالب برنامه، تکنیک و پرسشنامه‌هایی که تیم جیم‌لیک آماده کرده. هرکدام را به مال خودتان اضافه
            کنید و بعد مثل بقیهٔ قالب‌ها و پرسشنامه‌هایتان تغییرش دهید.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت محتوای آماده با خطا مواجه شد." />
        ) : !data.ready || CONTENT_KINDS.every((k) => data[k].length === 0) ? (
          <Card className="py-8">
            <div className="px-6">
              <EmptyState icon={Library} title="هنوز محتوای آماده‌ای منتشر نشده است." description="کمی بعد دوباره سر بزنید." />
            </div>
          </Card>
        ) : (
          <Tabs defaultValue={CONTENT_KINDS.find((k) => data[k].length > 0) ?? "workout"} className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {CONTENT_KINDS.map((kind) => (
                <TabsTrigger key={kind} value={kind}>
                  {TAB_LABEL[kind]} ({formatNumber(data[kind].length)})
                </TabsTrigger>
              ))}
            </TabsList>
            {CONTENT_KINDS.map((kind) => (
              <TabsContent key={kind} value={kind} className="space-y-3">
                {kind === "technique" && data.technique.length > 0 && (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={copyAll} disabled={busy !== null}>
                      {busy === "all" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      افزودن همه به تکنیک‌های من
                    </Button>
                  </div>
                )}
                {data[kind].length === 0 ? (
                  <Card className="py-8">
                    <div className="px-6">
                      <EmptyState icon={Library} title="در این بخش هنوز چیزی نیست." description="بخش‌های دیگر را ببینید." />
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {data[kind].map((item) => (
                      <Card key={item.id} className="gap-3 py-4">
                        <div className="space-y-1 px-5">
                          <p className="font-medium text-foreground">{item.title}</p>
                          {contentSummary(kind, item) && (
                            <p className="text-xs text-muted-foreground">{contentSummary(kind, item)}</p>
                          )}
                          {item.description && (
                            <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 px-5">
                          {kind !== "technique" && (
                            <Button size="sm" variant="outline" onClick={() => setPreview({ kind, item })}>
                              <Eye />
                              پیش‌نمایش
                            </Button>
                          )}
                          <Button size="sm" onClick={() => copy(kind, item)} disabled={busy !== null}>
                            {busy === item.id ? <Loader2 className="animate-spin" /> : <Plus />}
                            {DESTINATION[kind].add}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        <PreviewDialog
          preview={preview}
          busy={busy !== null}
          onClose={() => setPreview(null)}
          onCopy={() => preview && copy(preview.kind, preview.item)}
        />
        <p className="text-xs text-muted-foreground">
          نسخه‌ای که اضافه می‌کنید مال خودتان است: تغییرش روی نسخهٔ اصلی اثری ندارد و تغییرات بعدی نسخهٔ اصلی هم به آن
          نمی‌رسد. قالب‌ها در{" "}
          <Link href="/templates" className="text-primary underline underline-offset-4">
            قالب‌های من
          </Link>{" "}
          و پرسشنامه‌ها در{" "}
          <Link href="/questionnaires" className="text-primary underline underline-offset-4">
            پرسشنامه‌ها
          </Link>{" "}
          پیدا می‌شوند.
        </p>
      </div>
    </RoleGate>
  );
}

function PreviewDialog({
  preview,
  busy,
  onClose,
  onCopy,
}: {
  preview: { kind: ContentKind; item: ContentItem } | null;
  busy: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["content-library", preview?.kind, preview?.item.id],
    queryFn: () => getContentItem(preview!.kind, preview!.item.id),
    enabled: !!preview,
  });

  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{preview?.item.title}</DialogTitle>
        </DialogHeader>
        {isLoading || !data || !preview ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (
          <ContentPreview kind={preview.kind} detail={data} />
        )}
        {preview && (
          <DialogFooter>
            <Button onClick={onCopy} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              {DESTINATION[preview.kind].add}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
