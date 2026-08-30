"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSignOut } from "@/features/authentication/hooks/use-sign-out";

export function AccessBlockedNotice({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const signOut = useSignOut();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Icon className="size-6" />
        </div>
        <div className="space-y-1.5 px-6">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          خروج از حساب
        </Button>
      </Card>
    </div>
  );
}
