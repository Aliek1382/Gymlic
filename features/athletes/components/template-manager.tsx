"use client";

import { Apple, Dumbbell } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateFormDialog } from "./template-form-dialog";
import { TemplateList } from "./template-list";

export function TemplateManager() {
  return (
    <Tabs defaultValue="workout" className="space-y-4">
      <TabsList>
        <TabsTrigger value="workout">
          <Dumbbell className="size-4" />
          تمرینی
        </TabsTrigger>
        <TabsTrigger value="nutrition">
          <Apple className="size-4" />
          غذایی
        </TabsTrigger>
      </TabsList>

      <TabsContent value="workout" className="space-y-4">
        <div className="flex justify-end">
          <TemplateFormDialog kind="workout" />
        </div>
        <TemplateList kind="workout" />
      </TabsContent>

      <TabsContent value="nutrition" className="space-y-4">
        <div className="flex justify-end">
          <TemplateFormDialog kind="nutrition" />
        </div>
        <TemplateList kind="nutrition" />
      </TabsContent>
    </Tabs>
  );
}
