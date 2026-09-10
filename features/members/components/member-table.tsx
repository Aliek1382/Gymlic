"use client";

import Link from "next/link";

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
import { parseIsoDate } from "@/lib/iso-date";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VARIANT,
  NO_PLAN_LABEL,
} from "../constants/members";
import { daysUntilExpiry, expiryState } from "../utils/membership-expiry";
import { MemberRowActions } from "./member-row-actions";
import type { ClubMember } from "../types/member-types";

/** The end date, coloured by how close (or past) it is. */
function ExpiryCell({ expiresAt }: { expiresAt: string | null }) {
  const state = expiryState(expiresAt);
  const days = daysUntilExpiry(expiresAt);

  if (!expiresAt || days === null) {
    return <span className="text-muted-foreground">بدون تاریخ پایان</span>;
  }

  const date = formatPersianDate(parseIsoDate(expiresAt));

  if (state === "expired") {
    return (
      <div className="space-y-0.5">
        <Badge variant="destructive">منقضی‌شده</Badge>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    );
  }

  if (state === "expiring") {
    return (
      <div className="space-y-0.5">
        <Badge variant="warning">
          {days === 0 ? "امروز" : `${toPersianDigits(days)} روز مانده`}
        </Badge>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    );
  }

  return <span className="text-muted-foreground">{date}</span>;
}

export function MemberTable({
  clubId,
  members,
}: {
  clubId: string;
  members: ClubMember[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">
          لیست اعضا ({toPersianDigits(members.length)})
        </CardTitle>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>عضو</TableHead>
              <TableHead>طرح</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ عضویت</TableHead>
              <TableHead>پایان عضویت</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {member.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/members/${member.membershipId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {member.name}
                      </Link>
                      {member.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {member.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.planName ?? NO_PLAN_LABEL}
                </TableCell>
                <TableCell>
                  <Badge variant={MEMBER_STATUS_VARIANT[member.status]}>
                    {MEMBER_STATUS_LABEL[member.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPersianDate(new Date(member.joinedAt))}
                </TableCell>
                <TableCell>
                  <ExpiryCell expiresAt={member.expiresAt} />
                </TableCell>
                <TableCell>
                  <MemberRowActions clubId={clubId} member={member} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
