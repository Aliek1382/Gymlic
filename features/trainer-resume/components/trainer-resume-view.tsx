"use client";

import { AtSign, Award, Globe, Send } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatToman } from "@/lib/persian";
import type { SocialKey, TrainerResumeView } from "../types/trainer-resume-types";

const SOCIAL_ICON = {
  instagram: { icon: AtSign, label: "اینستاگرام" },
  telegram: { icon: Send, label: "تلگرام" },
  website: { icon: Globe, label: "وبسایت" },
} as const;

/** Read-only résumé, as an athlete sees it. */
export function TrainerResumeViewCard({ resume }: { resume: TrainerResumeView }) {
  const socials = (Object.keys(SOCIAL_ICON) as SocialKey[]).filter((key) => resume.socialLinks[key]);
  const isEmpty =
    !resume.bio &&
    resume.achievements.length === 0 &&
    resume.certificates.length === 0 &&
    resume.pricingTable.length === 0 &&
    socials.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {resume.trainerAvatarUrl && <AvatarImage src={resume.trainerAvatarUrl} alt={resume.trainerName} />}
          <AvatarFallback>{resume.trainerName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">{resume.trainerName}</h2>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map((key) => {
                const { icon: Icon, label } = SOCIAL_ICON[key];
                return (
                  <a
                    key={key}
                    href={resume.socialLinks[key]}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={label}
                    title={label}
                    className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="size-4" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground">این مربی هنوز رزومه‌اش را تکمیل نکرده است.</p>
      )}

      {resume.bio && (
        <Card>
          <CardHeader>
            <CardTitle>دربارهٔ مربی</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-7 text-foreground">{resume.bio}</p>
          </CardContent>
        </Card>
      )}

      {resume.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>افتخارات</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {resume.achievements.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                  <Award className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {resume.certificates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مدارک و گواهینامه‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {resume.certificates.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-xl border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="مدرک مربی" className="size-full object-cover" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {resume.pricingTable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>جدول تعرفه</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {resume.pricingTable.map((row, index) => (
              <div key={index} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
                </div>
                {/* formatToman rounds ("۱٫۳ میلیون"); the exact figure is one hover away. */}
                <p
                  className="shrink-0 text-sm font-semibold text-foreground"
                  title={`${formatNumber(row.priceToman)} تومان`}
                >
                  {formatToman(row.priceToman)} تومان
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
