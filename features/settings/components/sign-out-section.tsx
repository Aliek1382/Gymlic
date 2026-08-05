"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useSignOut } from "@/features/authentication";

export function SignOutSection() {
  const signOut = useSignOut();

  return (
    <Card className="gap-4 py-6">
      <div className="px-6">
        <CardTitle className="text-base">خروج از حساب</CardTitle>
      </div>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut />
          خروج از حساب کاربری
        </Button>
      </CardContent>
    </Card>
  );
}
