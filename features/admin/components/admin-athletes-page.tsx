"use client";

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
import { useQuery } from "@tanstack/react-query";

import { listAdminProfiles } from "../services/admin-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { SuspendToggle } from "@/features/admin/components/suspend-toggle";

export function AdminAthletesPage() {
  const { data } = useQuery({
    queryKey: ["admin", "athletes"],
    queryFn: async () => ({ rows: await listAdminProfiles("athlete") }),
  });

  const rows = data?.rows ?? [];

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
                      {athlete.trainer_name || "—"}
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
