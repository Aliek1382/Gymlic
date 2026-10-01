"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, parseLocaleNumber, toPersianDigits } from "@/lib/persian";
import { useSaveResume, useUploadCertificate } from "../hooks/use-trainer-resume";
import { VerificationPanel } from "./verification-panel";
import {
  SOCIAL_KEYS,
  type SocialKey,
  type TrainerResume,
} from "../types/trainer-resume-types";

const MAX_BIO = 5000;
const MAX_ACHIEVEMENTS = 30;
const MAX_CERTIFICATES = 12;
const MAX_PRICING_ROWS = 20;

const SOCIAL_LABEL: Record<SocialKey, { label: string; placeholder: string }> = {
  instagram: { label: "اینستاگرام", placeholder: "@username یا لینک پروفایل" },
  telegram: { label: "تلگرام", placeholder: "@username یا لینک کانال" },
  website: { label: "وبسایت", placeholder: "https://example.com" },
};

interface PricingDraft {
  title: string;
  price: string;
  description: string;
}

const textareaClass =
  "w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** Mounted once the saved résumé has loaded; its fields are local until "ذخیره". */
export function TrainerResumeEditor({ initial }: { initial: TrainerResume }) {
  const [bio, setBio] = useState(initial.bio ?? "");
  const [achievements, setAchievements] = useState<string[]>(initial.achievements);
  const [certificates, setCertificates] = useState<string[]>(initial.certificates);
  const [pricing, setPricing] = useState<PricingDraft[]>(
    initial.pricingTable.map((row) => ({
      title: row.title,
      price: formatNumber(row.priceToman),
      description: row.description,
    }))
  );
  const [social, setSocial] = useState<Record<SocialKey, string>>({
    instagram: initial.socialLinks.instagram ?? "",
    telegram: initial.socialLinks.telegram ?? "",
    website: initial.socialLinks.website ?? "",
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const save = useSaveResume();
  const upload = useUploadCertificate();

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    for (const file of files) {
      if (certificates.length >= MAX_CERTIFICATES) {
        toast.error(`حداکثر ${toPersianDigits(MAX_CERTIFICATES)} عکس مدرک مجاز است.`);
        return;
      }
      try {
        const url = await upload.mutateAsync(file);
        setCertificates((current) => [...current, url]);
      } catch (error) {
        toast.error(getErrorMessage(error, "آپلود عکس با خطا مواجه شد."));
      }
    }
  }

  async function handleSave() {
    const rows = [];
    for (const row of pricing) {
      const title = row.title.trim();
      const price = parseLocaleNumber(row.price);
      if (title === "" && price === null && row.description.trim() === "") continue;
      if (title === "") {
        toast.error("برای هر ردیف تعرفه عنوان بنویسید.");
        return;
      }
      if (price === null || !Number.isInteger(price) || price < 0) {
        toast.error(`قیمت «${title}» باید یک عدد صحیح و غیرمنفی (به تومان) باشد.`);
        return;
      }
      rows.push({ title, priceToman: price, description: row.description.trim() });
    }

    const socialLinks: TrainerResume["socialLinks"] = {};
    for (const key of SOCIAL_KEYS) {
      const value = social[key].trim();
      if (value) socialLinks[key] = value;
    }

    try {
      await save.mutateAsync({
        bio: bio.trim() || null,
        achievements: achievements.map((a) => a.trim()).filter(Boolean),
        certificates,
        pricingTable: rows,
        socialLinks,
      });
      toast.success("رزومه ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ رزومه با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>بیوگرافی</CardTitle>
          <CardDescription>خودتان را به شاگردانتان معرفی کنید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <textarea
            value={bio}
            rows={6}
            className={textareaClass}
            aria-label="بیوگرافی"
            onChange={(event) => setBio(event.target.value.slice(0, MAX_BIO))}
          />
          <p className="text-xs text-muted-foreground">
            {toPersianDigits(bio.length)} از {toPersianDigits(MAX_BIO)} نویسه
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>افتخارات</CardTitle>
          <CardDescription>هر افتخار در یک خط، مثلاً «قهرمان کشوری ۱۴۰۱».</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {achievements.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={item}
                maxLength={255}
                aria-label={`افتخار ${toPersianDigits(index + 1)}`}
                onChange={(event) =>
                  setAchievements((current) =>
                    current.map((a, i) => (i === index ? event.target.value : a))
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف افتخار"
                onClick={() => setAchievements((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={achievements.length >= MAX_ACHIEVEMENTS}
            onClick={() => setAchievements((current) => [...current, ""])}
          >
            <Plus />
            افزودن افتخار
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مدارک و گواهینامه‌ها</CardTitle>
          <CardDescription>
            عکس مدارک را اضافه کنید. حذف یا افزودن عکس بعد از «ذخیرهٔ رزومه» برای شاگردان اعمال می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {certificates.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="مدرک" className="size-full object-cover" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute end-1 top-1 size-8"
                  aria-label="حذف عکس مدرک"
                  onClick={() => setCertificates((current) => current.filter((u) => u !== url))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {upload.isPending && (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending || certificates.length >= MAX_CERTIFICATES}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus />
            افزودن عکس
          </Button>
          {initial.verification && (
            <VerificationPanel
              verification={initial.verification}
              hasSavedCertificates={initial.certificates.length > 0}
              unsaved={certificates.join("|") !== initial.certificates.join("|")}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>جدول تعرفه</CardTitle>
          <CardDescription>خدمات و قیمت‌ها را به تومان وارد کنید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricing.map((row, index) => (
            <div key={index} className="space-y-2 rounded-xl border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={`pricing-title-${index}`}>عنوان</Label>
                  <Input
                    id={`pricing-title-${index}`}
                    value={row.title}
                    maxLength={255}
                    onChange={(event) =>
                      setPricing((current) =>
                        current.map((r, i) => (i === index ? { ...r, title: event.target.value } : r))
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pricing-price-${index}`}>قیمت (تومان)</Label>
                  <Input
                    id={`pricing-price-${index}`}
                    inputMode="numeric"
                    value={row.price}
                    onChange={(event) =>
                      setPricing((current) =>
                        current.map((r, i) => (i === index ? { ...r, price: event.target.value } : r))
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label="حذف ردیف تعرفه"
                  onClick={() => setPricing((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`pricing-desc-${index}`}>توضیح</Label>
                <Input
                  id={`pricing-desc-${index}`}
                  value={row.description}
                  maxLength={500}
                  onChange={(event) =>
                    setPricing((current) =>
                      current.map((r, i) => (i === index ? { ...r, description: event.target.value } : r))
                    )
                  }
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={pricing.length >= MAX_PRICING_ROWS}
            onClick={() => setPricing((current) => [...current, { title: "", price: "", description: "" }])}
          >
            <Plus />
            افزودن ردیف
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>شبکه‌های اجتماعی</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {SOCIAL_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`social-${key}`}>{SOCIAL_LABEL[key].label}</Label>
              <Input
                id={`social-${key}`}
                dir="ltr"
                value={social[key]}
                maxLength={512}
                placeholder={SOCIAL_LABEL[key].placeholder}
                onChange={(event) => setSocial((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="button" disabled={save.isPending || upload.isPending} onClick={handleSave}>
        {save.isPending && <Loader2 className="animate-spin" />}
        ذخیرهٔ رزومه
      </Button>
    </div>
  );
}
