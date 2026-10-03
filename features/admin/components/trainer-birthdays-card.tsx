"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cake, Gift } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { useAdminCan } from "../hooks/use-admin-access";
import { listTrainerBirthdays } from "../services/trainer-gift-service";
import { TrainerGiftDialog } from "./trainer-gift-dialog";

function when(daysLeft: number, date: string): string {
  if (daysLeft === 0) return "امروز";
  if (daysLeft === 1) return "فردا";
  return formatPersianDate(new Date(`${date}T12:00:00`));
}

/** «تولد مربی‌ها در این هفته» on the admin overview, with a birthday gift code each. */
export function TrainerBirthdaysCard() {
  const can = useAdminCan();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "trainer-birthdays"], queryFn: listTrainerBirthdays });
  const [gifting, setGifting] = useState<{ id: string; name: string } | null>(null);

  if (!data || data.items.length === 0) return null;
  const canGift = can("finance.plans");

  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center gap-2 px-6">
        <Cake className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">تولد مربی‌ها در این هفته</CardTitle>
      </div>
      {!data.ready && (
        <p className="px-6 text-xs text-muted-foreground">
          برای هدیه‌ی کد تخفیف، به‌روزرسانی «کد تخفیف اختصاصی یک مربی» را از صفحه‌ی دیتابیس اجرا کنید.
        </p>
      )}
      <ul className="divide-y divide-border px-6">
        {data.items.map((t) => {
          const name = [t.first_name, t.last_name].filter(Boolean).join(" ") || "بدون نام";
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <Link href={`/admin/trainers/detail?id=${t.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {toPersianDigits(t.age)} ساله ·{" "}
                  {t.days_left === 0 ? <Badge variant="success">امروز</Badge> : when(t.days_left, t.date)}
                </p>
              </div>
              {t.gifted ? (
                <Badge variant="secondary">هدیه فرستاده شد</Badge>
              ) : (
                canGift &&
                data.ready && (
                  <Button size="sm" variant="outline" onClick={() => setGifting({ id: t.id, name })}>
                    <Gift />
                    هدیه‌ی تولد
                  </Button>
                )
              )}
            </li>
          );
        })}
      </ul>
      <TrainerGiftDialog
        key={gifting?.id ?? "closed"}
        trainer={gifting}
        occasion="birthday"
        onClose={() => setGifting(null)}
        onSent={() => void queryClient.invalidateQueries({ queryKey: ["admin", "trainer-birthdays"] })}
      />
    </Card>
  );
}
