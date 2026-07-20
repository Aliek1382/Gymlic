"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";
import type { AccountType } from "@/types/database.types";

export function MobileSidebar({ accountType }: { accountType: AccountType }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu />
        <span className="sr-only">باز کردن منو</span>
      </Button>
      <SheetContent side="right" className="w-72 p-0">
        <SheetTitle className="sr-only">منوی جیم‌لیک</SheetTitle>
        <SidebarContent
          accountType={accountType}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
