"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Search, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useAthletes } from "@/features/athletes";
import { ProgressPageContent } from "./progress-page-content";

export function TrainerProgressBrowser() {
  const athletes = useAthletes();
  const [search, setSearch] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const filteredAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (athletes.data ?? []).filter((athlete) =>
      athlete.name.toLowerCase().includes(query)
    );
  }, [athletes.data, search]);

  if (athletes.isLoading) {
    return <TableCardSkeleton />;
  }

  if (selectedAthlete) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedAthlete(null)}>
          <ChevronLeft />
          بازگشت به لیست ورزشکاران
        </Button>
        <p className="text-sm text-muted-foreground">
          روند پیشرفت <span className="font-medium text-foreground">{selectedAthlete.name}</span>
        </p>
        <ProgressPageContent athleteId={selectedAthlete.id} />
      </div>
    );
  }

  if ((athletes.data?.length ?? 0) === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="ابتدا از بخش ورزشکاران، یک ورزشکار اضافه کنید."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام و نام خانوادگی ورزشکار..."
          className="pr-10"
        />
      </div>

      {filteredAthletes.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="ورزشکاری با این نام و نام خانوادگی پیدا نشد."
          />
        </Card>
      ) : (
        <Card className="gap-4 py-5">
          <div className="space-y-2 px-6">
            {filteredAthletes.map((athlete) => (
              <button
                key={athlete.id}
                type="button"
                onClick={() => setSelectedAthlete(athlete)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs">
                    {athlete.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <p className="flex-1 text-sm font-medium text-foreground">
                  {athlete.name}
                </p>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
