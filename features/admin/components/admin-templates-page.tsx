"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  getTemplates,
  saveTemplates,
  type TemplateCatalogEntry,
  type TemplateSetting,
  type TemplateSettings,
} from "../services/admin-communication-service";
import { SettingsStorageNotice } from "./settings-storage-notice";

const QUERY_KEY = ["admin", "templates"] as const;

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

/** {name} placeholders in a text that this template doesn't fill. */
function unknownPlaceholders(text: string, vars: Record<string, string>): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{([^{}\s]+)\}/g), (m) => m[1]))).filter((v) => !(v in vars));
}

export function AdminTemplatesPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getTemplates });
  // One group at a time by default: all 40-odd templates at once is a very long page.
  const [group, setGroup] = useState<string>("account");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim();
    return (data?.catalog ?? []).filter(
      (t) =>
        (group === "all" || t.group === group) &&
        (!term || t.label.includes(term) || t.title.includes(term) || t.body.includes(term))
    );
  }, [data, group, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">قالب متن اعلان‌ها</h1>
        <p className="text-sm text-muted-foreground">
          متن همهٔ اعلان‌ها و یادآورهای خودکار سایت — همان متنی که در پنل کاربر، روی گوشی و در پیامک یا
          ایمیل می‌رسد. جای مقدارهای متغیر را با {"{نام}"} بنویسید (فهرستشان زیر هر قالب هست). با خاموش‌کردن
          یک قالب، آن اعلان دیگر فرستاده نمی‌شود.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت قالب‌ها با خطا مواجه شد." />
      ) : (
        <>
          {!data.storageReady && <SettingsStorageNotice />}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {[["all", "همه"], ...Object.entries(data.groups)].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGroup(key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    group === key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative lg:w-64">
              <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در قالب‌ها" className="pr-9" />
            </div>
          </div>

          <div className="space-y-3">
            {visible.map((entry) => (
              <TemplateCard
                key={`${entry.key}-${JSON.stringify(data.settings[entry.key] ?? null)}`}
                entry={entry}
                groupLabel={data.groups[entry.group] ?? ""}
                all={data.settings}
                locked={!data.storageReady}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TemplateCard({
  entry,
  groupLabel,
  all,
  locked,
}: {
  entry: TemplateCatalogEntry;
  groupLabel: string;
  all: TemplateSettings;
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const initial: TemplateSetting = all[entry.key] ?? { enabled: true, title: "", body: "" };
  const [enabled, setEnabled] = useState(initial.enabled);
  // The fields show the text in effect; saving the default unchanged stores "no override".
  const [title, setTitle] = useState(initial.title || entry.title);
  const [body, setBody] = useState(initial.body || entry.body);
  const [saving, setSaving] = useState(false);

  const customized = initial.title !== "" || initial.body !== "";
  const dirty = enabled !== initial.enabled || title !== (initial.title || entry.title) || body !== (initial.body || entry.body);
  const unknown = unknownPlaceholders(`${title} ${body}`, entry.vars);

  async function save(next: TemplateSetting) {
    setSaving(true);
    try {
      // The whole group goes back: the server normalizes and stores it in one row.
      await saveTemplates({ ...all, [entry.key]: next });
      toast.success("قالب ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ قالب ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={cn("gap-3 py-4", !enabled && "opacity-70")}>
      <div className="flex flex-wrap items-start gap-3 px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{entry.label}</p>
            <Badge variant="secondary">{groupLabel}</Badge>
            {customized && <Badge variant="warning">تغییر داده‌شده</Badge>}
            {!initial.enabled && <Badge variant="destructive">خاموش</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">گیرنده: {entry.to}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={locked} />
          {enabled ? "روشن" : "خاموش"}
        </label>
      </div>

      <div className="space-y-3 px-5">
        <div className="space-y-1.5">
          <Label htmlFor={`tpl-title-${entry.key}`} className="text-xs">عنوان</Label>
          <Input
            id={`tpl-title-${entry.key}`}
            value={title}
            maxLength={255}
            disabled={locked}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tpl-body-${entry.key}`} className="text-xs">متن</Label>
          <textarea
            id={`tpl-body-${entry.key}`}
            rows={2}
            maxLength={1000}
            disabled={locked}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={TEXTAREA_CLASS}
          />
        </div>
        {Object.keys(entry.vars).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>متغیرها:</span>
            {Object.entries(entry.vars).map(([name, meaning]) => (
              <span key={name} className="rounded-md bg-muted px-1.5 py-0.5" title={meaning}>
                <span dir="ltr" className="font-mono">{`{${name}}`}</span> {meaning}
              </span>
            ))}
          </div>
        )}
        {unknown.length > 0 && (
          <p className="text-xs text-destructive">
            این متغیرها در این قالب پر نمی‌شوند و همان‌طور نوشته‌شده به کاربر می‌رسند:{" "}
            <span dir="ltr" className="font-mono">{unknown.map((u) => `{${u}}`).join(" ")}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={locked || saving || !dirty || !title.trim()}
            onClick={() =>
              save({
                enabled,
                title: title.trim() === entry.title ? "" : title.trim(),
                body: body.trim() === entry.body ? "" : body.trim(),
              })
            }
          >
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
          {customized && (
            <Button
              size="sm"
              variant="ghost"
              disabled={locked || saving}
              onClick={() => save({ enabled, title: "", body: "" })}
            >
              <RotateCcw />
              بازگشت به متن پیش‌فرض
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
