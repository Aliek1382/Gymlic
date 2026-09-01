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
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import {
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VARIANT,
  PLAN_TIER_LABEL,
} from "../constants/members";
import { MemberRowActions } from "./member-row-actions";
import type { ClubMember } from "../types/member-types";

export function MemberTable({ members }: { members: ClubMember[] }) {
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
                      <p className="font-medium text-foreground">{member.name}</p>
                      {member.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {member.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {PLAN_TIER_LABEL[member.planTier]}
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
                  <MemberRowActions member={member} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
