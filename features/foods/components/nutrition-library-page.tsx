"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureEnabled } from "@/features/site-settings";
import { AddSupplementDialog, SupplementList } from "@/features/supplements";
import { AddFoodDialog } from "./add-food-dialog";
import { FoodList } from "./food-list";

type LibraryTab = "foods" | "supplements";

/** One library for what goes in a nutrition plan: foods, and the supplements next to them. */
export function NutritionLibraryPage() {
  const supplementsEnabled = useFeatureEnabled("supplements");
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<LibraryTab>(
    searchParams.get("tab") === "supplements" ? "supplements" : "foods"
  );
  const activeTab: LibraryTab = supplementsEnabled ? tab : "foods";

  return (
    <Tabs value={activeTab} onValueChange={(next) => setTab(next as LibraryTab)}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {supplementsEnabled ? "کتابخانه غذاها و مکمل‌ها" : "کتابخانه غذاها"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "foods"
                ? "مواد غذایی پرتکرار به‌صورت پیش‌فرض در دسترس است؛ غذاهای اختصاصی خودتان را هم می‌توانید اضافه کنید."
                : "مکمل‌های پرمصرف به‌صورت پیش‌فرض در دسترس است؛ مکمل‌های اختصاصی خودتان را هم می‌توانید اضافه کنید."}
            </p>
          </div>
          {activeTab === "foods" ? <AddFoodDialog /> : <AddSupplementDialog />}
        </div>

        {supplementsEnabled && (
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="foods">غذاها</TabsTrigger>
            <TabsTrigger value="supplements">مکمل‌ها</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="foods">
          <FoodList />
        </TabsContent>
        {supplementsEnabled && (
          <TabsContent value="supplements">
            <SupplementList />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
