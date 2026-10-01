"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Library, Loader2, Pencil, Plus, Search, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { ContentPreview, contentSummary } from "@/features/content-library/components/content-preview";
import {
  CONTENT_KINDS,
  CONTENT_KIND_LABEL,
  type ContentItem,
  type ContentKind,
} from "@/features/content-library/services/content-library-service";
import { QuestionnaireBuilderDialog } from "@/features/questionnaires/components/questionnaire-builder-dialog";
import type { Questionnaire } from "@/features/questionnaires/types/questionnaire-types";
import {
  createTechnique,
  deleteContent,
  getAdminContentItem,
  listAdminContent,
  listContentCandidates,
  publishContent,
  savePublicQuestionnaire,
  updateContent,
} from "../services/admin-content-service";

const QUERY_KEY = ["admin", "content"] as const;

const TAB_LABEL: Record<ContentKind, string> = {
  workout: "قالب‌های تمرینی",
  nutrition: "قالب‌های غذایی",
  technique: "تکنیک‌ها",
  questionnaire: "پرسشنامه‌ها",
};

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function AdminContentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: listAdminContent });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const [tab, setTab] = useState<ContentKind>("workout");
  const [preview, setPreview] = useState<{ kind: ContentKind; id: string; title: string } | null>(null);
  const [editing, setEditing] = useState<{ kind: ContentKind; item: ContentItem } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: ContentKind; item: ContentItem } | null>(null);
  const [publishing, setPublishing] = useState<ContentKind | null>(null);
  const [newTechnique, setNewTechnique] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | "new" | null>(null);

  async function editQuestionnaire(item: ContentItem) {
    try {
      const detail = await getAdminContentItem("questionnaire", item.id);
      setQuestionnaire({
        id: detail.id,
        title: detail.title,
        description: detail.description,
        priceToman: null,
        isActive: true,
        assignedCount: 0,
        submittedCount: 0,
        createdAt: item.created_at,
        questions: (detail.questions ?? []).map((q) => ({
          id: q.id,
          type: q.type,
          label: q.label,
          options: q.options,
          isRequired: q.is_required,
        })),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "دریافت پرسشنامه ناموفق بود."));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">محتوای آماده برای مربی‌ها</h1>
        <p className="text-sm text-muted-foreground">
          قالب برنامه، تکنیک و پرسشنامه‌هایی که همهٔ مربی‌ها در «محتوای آماده» می‌بینند و به مال خودشان اضافه
          می‌کنند. قالب‌ها از قالب خوبِ یک مربی منتشر می‌شوند (یک نسخه از آن)؛ تکنیک و پرسشنامه را همین‌جا هم
          می‌شود نوشت. تغییر یا حذف اینجا روی نسخه‌هایی که مربی‌ها برداشته‌اند اثری ندارد.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت محتوا با خطا مواجه شد." />
      ) : !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={Library}
              title="محتوای آماده هنوز فعال نیست."
              description="به‌روزرسانی «محتوای آماده برای مربی‌ها و عکس و ویدیوی حرکات (فاز ۸)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
            />
          </div>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as ContentKind)} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {CONTENT_KINDS.map((kind) => (
                <TabsTrigger key={kind} value={kind}>
                  {TAB_LABEL[kind]} ({formatNumber(data[kind].length)})
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex flex-wrap gap-2">
              {tab === "technique" && (
                <Button onClick={() => setNewTechnique(true)}>
                  <Plus />
                  تکنیک جدید
                </Button>
              )}
              {tab === "questionnaire" && (
                <Button onClick={() => setQuestionnaire("new")}>
                  <Plus />
                  پرسشنامهٔ جدید
                </Button>
              )}
              <Button variant="outline" onClick={() => setPublishing(tab)}>
                <Share2 />
                انتشار از {tab === "technique" ? "تکنیک" : tab === "questionnaire" ? "پرسشنامه" : "قالب"} مربی‌ها
              </Button>
            </div>
          </div>

          {CONTENT_KINDS.map((kind) => (
            <TabsContent key={kind} value={kind}>
              {data[kind].length === 0 ? (
                <Card className="py-8">
                  <div className="px-6">
                    <EmptyState
                      icon={Library}
                      title={`هنوز ${CONTENT_KIND_LABEL[kind]}ی منتشر نشده است.`}
                      description={
                        kind === "workout" || kind === "nutrition"
                          ? "یکی از قالب‌های مربی‌ها را با «انتشار از قالب مربی‌ها» منتشر کنید."
                          : "یکی بنویسید یا از مال مربی‌ها منتشر کنید."
                      }
                    />
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {data[kind].map((item) => (
                    <Card key={item.id} className="gap-2 py-4">
                      <div className="flex items-start gap-2 px-5">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[contentSummary(kind, item), formatRelativeTime(new Date(item.created_at))].filter(Boolean).join(" · ")}
                          </p>
                          {item.description && <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                        </div>
                        {kind !== "technique" && (
                          <Button size="icon" variant="ghost" aria-label={`پیش‌نمایش ${item.title}`} onClick={() => setPreview({ kind, id: item.id, title: item.title })}>
                            <Eye />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`ویرایش ${item.title}`}
                          onClick={() => (kind === "questionnaire" ? editQuestionnaire(item) : setEditing({ kind, item }))}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={`حذف ${item.title}`}
                          onClick={() => setDeleting({ kind, item })}
                        >
                          <Trash2 />
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

      <PreviewDialog preview={preview} onClose={() => setPreview(null)} />
      <EditDialog
        key={editing ? `${editing.kind}-${editing.item.id}` : "closed"}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
      <TechniqueDialog open={newTechnique} onClose={() => setNewTechnique(false)} onSaved={refresh} />
      <PublishDialog kind={publishing} onClose={() => setPublishing(null)} onPublished={refresh} />
      {questionnaire && (
        <QuestionnaireBuilderDialog
          open
          onOpenChange={(open) => !open && setQuestionnaire(null)}
          questionnaire={questionnaire === "new" ? undefined : questionnaire}
          onSave={async (input) => {
            await savePublicQuestionnaire(input);
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف «${deleting?.item.title ?? ""}»`}
        description="از محتوای آماده برداشته می‌شود. نسخه‌هایی که مربی‌ها تا الان برداشته‌اند می‌مانند."
        confirmLabel="حذف"
        errorMessage="حذف ناموفق بود."
        onConfirm={async () => {
          if (!deleting) return;
          await deleteContent(deleting.kind, deleting.item.id);
          toast.success("حذف شد.");
          refresh();
        }}
      />
    </div>
  );
}

function PreviewDialog({
  preview,
  onClose,
}: {
  preview: { kind: ContentKind; id: string; title: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "content", "item", preview?.kind, preview?.id],
    queryFn: () => getAdminContentItem(preview!.kind, preview!.id),
    enabled: !!preview,
  });
  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{preview?.title}</DialogTitle>
        </DialogHeader>
        {isLoading || !data || !preview ? <Skeleton className="h-48 rounded-xl" /> : <ContentPreview kind={preview.kind} detail={data} />}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: { kind: ContentKind; item: ContentItem } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(editing?.item.title ?? "");
  const [description, setDescription] = useState(editing?.item.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing || !title.trim()) return;
    setSaving(true);
    try {
      await updateContent(editing.kind, editing.item.id, title.trim(), description.trim());
      toast.success("ذخیره شد.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش {editing ? CONTENT_KIND_LABEL[editing.kind] : ""}</DialogTitle>
          {editing && editing.kind !== "technique" && (
            <DialogDescription>
              محتوای خود قالب (روزها و حرکت‌ها یا وعده‌ها) از قالب مربی آمده؛ برای تغییرش، قالب اصلاح‌شدهٔ مربی را دوباره منتشر کنید.
            </DialogDescription>
          )}
        </DialogHeader>
        <TitleDescriptionFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} />
        <DialogFooter>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TechniqueDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createTechnique(name.trim(), description.trim());
      toast.success("تکنیک اضافه شد.");
      setName("");
      setDescription("");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تکنیک جدید</DialogTitle>
          <DialogDescription>مربی‌ها توضیحش را کنار حرکتی می‌بینند که این تکنیک را دارد.</DialogDescription>
        </DialogHeader>
        <TitleDescriptionFields
          title={name}
          description={description}
          onTitle={setName}
          onDescription={setDescription}
          titleLabel="نام تکنیک"
        />
        <DialogFooter>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TitleDescriptionFields({
  title,
  description,
  onTitle,
  onDescription,
  titleLabel = "عنوان",
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  titleLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content-title">{titleLabel}</Label>
        <Input id="content-title" value={title} maxLength={255} onChange={(e) => onTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content-description">
          توضیح <span className="text-muted-foreground">(اختیاری)</span>
        </Label>
        <textarea
          id="content-description"
          rows={4}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
}

/** Pick one of the trainers' own items, preview it, and publish a copy. */
function PublishDialog({ kind, onClose, onPublished }: { kind: ContentKind | null; onClose: () => void; onPublished: () => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["admin", "content", "candidates", kind, debounced],
    queryFn: () => listContentCandidates(kind!, debounced),
    enabled: !!kind,
  });
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["admin", "content", "item", kind, selected],
    queryFn: () => getAdminContentItem(kind!, selected!),
    enabled: !!kind && !!selected,
  });

  function close() {
    setSelected(null);
    setSearch("");
    onClose();
  }

  async function publish() {
    if (!kind || !selected) return;
    setPublishing(true);
    try {
      await publishContent(kind, selected);
      toast.success("منتشر شد؛ مربی‌ها از حالا آن را در «محتوای آماده» می‌بینند.");
      onPublished();
      close();
    } catch (error) {
      toast.error(getErrorMessage(error, "انتشار ناموفق بود."));
    } finally {
      setPublishing(false);
    }
  }

  const chosen = candidates?.find((c) => c.id === selected);

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>انتشار {kind ? CONTENT_KIND_LABEL[kind] : ""} از مربی‌ها</DialogTitle>
          <DialogDescription>
            یک نسخه منتشر می‌شود؛ مربی می‌تواند مال خودش را مثل قبل تغییر دهد یا حذف کند.
            {kind === "workout" && " تکنیک‌هایی که در قالب به کار رفته‌اند هم همراهش منتشر می‌شوند."}
            {(kind === "workout" || kind === "nutrition") &&
              " قالبی که از حرکت یا غذای شخصیِ مربی استفاده کند منتشر نمی‌شود، مگر آن‌ها اول به بانک عمومی منتقل شوند."}
          </DialogDescription>
        </DialogHeader>

        {selected && chosen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{chosen.title}</p>
                <p className="text-xs text-muted-foreground">از {chosen.owner_name}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                انتخاب دیگری
              </Button>
            </div>
            {loadingDetail || !detail || !kind ? <Skeleton className="h-40 rounded-xl" /> : <ContentPreview kind={kind} detail={detail} />}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در عنوان یا نام مربی" className="pr-9" />
            </div>
            {isLoading ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : !candidates || candidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">موردی پیدا نشد.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setSelected(c.id)} className="w-full px-4 py-3 text-start hover:bg-muted/50">
                      <p className="font-medium text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.owner_name}
                        {c.days != null && ` · ${formatNumber(c.days)} ${kind === "workout" ? "روز" : kind === "nutrition" ? "وعده" : "سؤال"}`}
                        {` · ${formatRelativeTime(new Date(c.created_at))}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selected && (
          <DialogFooter>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? <Loader2 className="animate-spin" /> : <Share2 />}
              انتشار برای همهٔ مربی‌ها
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
