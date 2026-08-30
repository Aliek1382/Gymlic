"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebarContent } from "./admin-sidebar";

export function AdminMobileSidebar() {
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
        <SheetTitle className="sr-only">منوی پنل مدیریت</SheetTitle>
        <AdminSidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
