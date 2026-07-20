import { MessageCircle } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "../shared/empty-state";

export function CoachMessageCard() {
  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between px-6">
        <CardTitle className="text-base">پیام مربی</CardTitle>
        <Badge variant="secondary">به‌زودی</Badge>
      </div>
      <div className="px-6">
        <EmptyState
          icon={MessageCircle}
          title="امکان پیام‌رسانی هنوز فعال نشده است."
          description="در نسخه‌های بعدی می‌توانید مستقیم با مربی خود گفتگو کنید."
        />
      </div>
    </Card>
  );
}
