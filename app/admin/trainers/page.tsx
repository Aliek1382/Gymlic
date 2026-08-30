import Link from "next/link";
import { Dumbbell } from "lucide-react";

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

export const metadata = { title: "مربی‌ها | پنل مدیریت جیم‌لیک" };

export default async function AdminTrainersPage() {
  const supabase = await createClient();

  const [{ data: trainers }, { data: relations }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, email, birth_date, avatar_url, is_suspended")
        .eq("account_type", "trainer")
        .order("created_at", { ascending: false }),
      supabase.from("trainer_athletes").select("trainer_id").eq("status", "active"),
      supabase
        .from("memberships")
        .select("user_id, clubs(name)")
        .eq("role", "trainer")
        .eq("status", "active")
        .returns<{ user_id: string; clubs: { name: string } | null }[]>(),
    ]);

  const studentCounts = new Map<string, number>();
  for (const r of relations ?? []) {
    studentCounts.set(r.trainer_id, (studentCounts.get(r.trainer_id) ?? 0) + 1);
  }

  const clubByTrainer = new Map<string, string>();
  for (const m of memberships ?? []) {
    if (m.clubs?.name && !clubByTrainer.has(m.user_id)) {
      clubByTrainer.set(m.user_id, m.clubs.name);
    }
  }

  const rows = trainers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">مربی‌ها</h1>
        <p className="text-sm text-muted-foreground">
          همه مربی‌های ثبت‌نام‌شده در پلتفرم، مستقل یا وابسته به باشگاه.
        </p>
      </div>

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            لیست مربی‌ها ({formatNumber(rows.length)})
          </CardTitle>
        </div>

        {rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={Dumbbell}
              title="هنوز مربی‌ای ثبت نشده است."
              description="با ثبت‌نام اولین مربی، اطلاعاتش اینجا نمایش داده می‌شود."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>مربی</TableHead>
                <TableHead>تماس</TableHead>
                <TableHead>سن</TableHead>
                <TableHead>باشگاه</TableHead>
                <TableHead>تعداد شاگردان</TableHead>
                <TableHead>وضعیت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((trainer) => {
                const name =
                  [trainer.first_name, trainer.last_name].filter(Boolean).join(" ") ||
                  "بدون نام";
                const age = formatAge(trainer.birth_date);

                return (
                  <TableRow key={trainer.id}>
                    <TableCell>
                      <Link
                        href={`/admin/trainers/${trainer.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="size-8">
                          {trainer.avatar_url && (
                            <AvatarImage src={trainer.avatar_url} alt={name} />
                          )}
                          <AvatarFallback className="text-xs">
                            {name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-foreground">{name}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {trainer.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {trainer.phone}
                        </p>
                      )}
                      {trainer.email && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {trainer.email}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {age ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {clubByTrainer.get(trainer.id) ?? "مستقل"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatNumber(studentCounts.get(trainer.id) ?? 0)}
                    </TableCell>
                    <TableCell>
                      {trainer.is_suspended ? (
                        <Badge variant="destructive">مسدود</Badge>
                      ) : (
                        <Badge variant="success">فعال</Badge>
                      )}
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
