"use client";

import Link from "next/link";
import { Cake } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { useUpcomingBirthdays } from "../../hooks/use-upcoming-birthdays";

function when(daysLeft: number, date: string): string {
  if (daysLeft === 0) return "امروز";
  if (daysLeft === 1) return "فردا";
  return formatPersianDate(new Date(`${date}T12:00:00`));
}

/** The coming week's birthdays; nothing when there are none. */
export function UpcomingBirthdays() {
  const birthdays = useUpcomingBirthdays();
  const items = birthdays.data ?? [];
  if (items.length === 0) return null;

  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center gap-2 px-6">
        <Cake className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">تولدهای این هفته</CardTitle>
      </div>
      <ul className="space-y-1 px-6">
        {items.map((b) => (
          <li key={`${b.athleteId}-${b.date}`} className="flex items-center justify-between gap-3 rounded-lg py-1.5">
            <Link href={`/athletes/profile?id=${b.athleteId}`} className="text-sm font-medium text-foreground hover:underline">
              {b.name}
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {toPersianDigits(b.age)} ساله
              </span>
            </Link>
            {b.daysLeft === 0 ? (
              <Badge variant="success">امروز</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">{when(b.daysLeft, b.date)}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
