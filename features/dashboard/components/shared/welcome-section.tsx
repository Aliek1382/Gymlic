"use client";

import { useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";

import { formatPersianDate } from "@/lib/persian";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "صبح بخیر";
  if (hour < 18) return "عصر بخیر";
  return "شب بخیر";
}

export function WelcomeSection({
  name,
  subtitle,
}: {
  name: string;
  subtitle: string;
}) {
  const greeting = useMemo(getGreeting, []);
  const today = useMemo(() => formatPersianDate(new Date()), []);

  return (
    <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}، {name}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm"
      >
        <ChevronDown className="size-4 text-muted-foreground" />
        <span>{today}</span>
        <Calendar className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
