"use client";

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
import { formatAge, formatNumber, formatPersianDate } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { getAdminTrainerDetail } from "../services/admin-service";
import { useSearchParams } from "next/navigation";


import { NotFoundNotice } from "@/components/not-found-notice";
import { RouteLoading } from "@/components/layout/route-loading";
import { AdminProfileEditForm } from "./admin-profile-edit-form";
import { SuspendToggle } from "./suspend-toggle";

export function AdminTrainerDetailPage() {
  // Was /admin/trainers/[id] — see AdminClubDetailPage for why the id moved
  // into the query string.
  const id = useSearchParams().get("id") ?? "";

  const { data, isPending } = useQuery({
    queryKey: ["admin", "trainer", id],
    enabled: id.length > 0,
    queryFn: () => getAdminTrainerDetail(id),
  });

  if (isPending) return <RouteLoading />;

  const trainer = data?.trainer;
  if (!trainer || trainer.account_type !== "trainer") {
    return (
      <NotFoundNotice
        title="مربی پیدا نشد"
        description="این مربی وجود ندارد یا حساب او حذف شده است."
      />
    );
  }

  const name =
    [trainer.first_name, trainer.last_name].filter(Boolean).join(" ") || "بدون نام";
  const age = formatAge(trainer.birth_date);
  const studentRows = data?.students ?? [];

  return (

    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {trainer.avatar_url && <AvatarImage src={trainer.avatar_url} alt={name} />}
            <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            <p className="text-sm text-muted-foreground">
              {trainer?.club_name ?? "مربی مستقل"}
              {age && ` · ${age}`}
            </p>
          </div>
        </div>
        <SuspendToggle userId={trainer.id} isSuspended={trainer.is_suspended} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">وضعیت حساب</p>
            {trainer.is_suspended ? (
              <Badge className="mt-2" variant="destructive">مسدود</Badge>
            ) : (
              <Badge className="mt-2" variant="success">فعال</Badge>
            )}
          </div>
        </Card>
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">تعداد شاگردان</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {formatNumber(studentRows.length)}
            </p>
          </div>
        </Card>
        <Card className="gap-2 py-5">
          <div className="px-6">
            <p className="text-sm text-muted-foreground">تاریخ عضویت در پلتفرم</p>
            <p className="mt-2 text-sm text-foreground">
              {formatPersianDate(new Date(trainer.created_at))}
            </p>
          </div>
        </Card>
      </div>

      <AdminProfileEditForm
        userId={trainer.id}
        firstName={trainer.first_name}
        lastName={trainer.last_name}
        email={trainer.email}
        phone={trainer.phone}
        birthDate={trainer.birth_date}
      />

      <Card className="gap-4 py-5">
        <div className="px-6">
          <CardTitle className="text-base">
            شاگردان ({formatNumber(studentRows.length)})
          </CardTitle>
        </div>

        {studentRows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            این مربی هنوز شاگردی ندارد.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ورزشکار</TableHead>
                <TableHead>تماس</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentRows.map((s, index) => {
                const studentName =
                  [s.first_name, s.last_name].filter(Boolean).join(" ") ||
                  "بدون نام";
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-foreground">
                      {studentName}
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {s.phone ?? "—"}
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
