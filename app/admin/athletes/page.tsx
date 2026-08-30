import { UsersRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAge, formatNumber } from "@/lib/persian";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { SuspendToggle } from "@/features/admin/components/suspend-toggle";

export const metadata = { title: "ورزشکاران | پنل مدیریت جیم‌لیک" };

export default async function AdminAthletesPage() {
  const supabase = await createClient();

  const [{ data: athletes }, { data: relations }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, birth_date, avatar_url, is_suspended")
      .eq("account_type", "athlete")
      .order("created_at", { ascending: false }),
    supabase
      .from("trainer_athletes")
      .select("athlete_id, profiles:trainer_id(first_name, last_name)")
      .eq("status", "active")
      .returns<
        {
          athlete_id: string;
          profiles: { first_name: string | null; last_name: string | null } | null;
        }[]
      >(),
  ]);

  const trainerByAthlete = new Map<string, string>();
  for (const r of relations ?? []) {
    if (trainerByAthlete.has(r.athlete_id)) continue;
    const name = [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ");
    if (name) trainerByAthlete.set(r.athlete_id, name);
  }

  const rows = athletes ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">ورزشکاران</h1>
        <p className="text-sm text-muted-foreground">
          همه ورزشکاران ثبت‌نام‌شده در پلتفرم و مربی هرکدام.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            لیست ورزشکاران ({formatNumber(rows.length)})
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={UsersRound}
              title="هنوز ورزشکاری ثبت نشده است."
              description="با ثبت‌نام اولین ورزشکار، اطلاعاتش اینجا نمایش داده می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ورزشکار</TableHead>
                <TableHead>تماس</TableHead>
                <TableHead>سن</TableHead>
                <TableHead>مربی</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((athlete) => {
                const name =
                  [athlete.first_name, athlete.last_name].filter(Boolean).join(" ") ||
                  "بدون نام";
                const age = formatAge(athlete.birth_date);

                return (
                  <TableRow key={athlete.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {athlete.avatar_url && (
                            <AvatarImage src={athlete.avatar_url} alt={name} />
                          )}
                          <AvatarFallback className="text-xs">
                            {name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-foreground">{name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {athlete.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {age ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {trainerByAthlete.get(athlete.id) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {athlete.is_suspended ? (
                        <Badge variant="destructive">مسدود</Badge>
                      ) : (
                        <Badge variant="success">فعال</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <SuspendToggle userId={athlete.id} isSuspended={athlete.is_suspended} />
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
