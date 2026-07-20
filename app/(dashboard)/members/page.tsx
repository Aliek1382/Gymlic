import { redirect } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPersianDate } from "@/lib/persian";
import { createClient } from "@/lib/supabase/server";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";

export const metadata = { title: "اعضا | جیم‌لیک" };

const PLAN_LABEL: Record<string, string> = {
  elite: "ویژه (Elite)",
  basic: "پایه",
  daily: "روزانه",
};

const STATUS_LABEL: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار",
  suspended: "غیرفعال",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
  active: "success",
  pending: "warning",
  suspended: "secondary",
};

export default async function MembersPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  const clubId = context.activeMembership!.clubId;
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, plan_tier, status, joined_at, profiles(first_name, last_name, phone)")
    .eq("club_id", clubId)
    .eq("role", "athlete")
    .order("joined_at", { ascending: false })
    .returns<
      {
        id: string;
        plan_tier: string;
        status: string;
        joined_at: string;
        profiles: {
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
        } | null;
      }[]
    >();

  const rows = members ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">اعضا</h1>
          <p className="text-sm text-muted-foreground">
            مدیریت اعضای باشگاه و وضعیت اشتراک آن‌ها
          </p>
        </div>
        <Button>
          <UserPlus />
          افزودن عضو جدید
        </Button>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            لیست اعضا ({rows.length.toLocaleString("fa-IR")})
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Users}
              title="هنوز عضوی ثبت نشده است."
              description="اولین عضو باشگاه خود را ثبت کنید."
              actionLabel="ثبت عضو"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عضو</TableHead>
                <TableHead>طرح</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ عضویت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const profile = row.profiles;
                const name =
                  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
                  "بدون نام";
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{name}</p>
                          {profile?.phone && (
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {profile.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {PLAN_LABEL[row.plan_tier] ?? row.plan_tier}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPersianDate(new Date(row.joined_at))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
