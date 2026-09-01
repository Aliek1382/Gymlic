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
import { TRAINER_STATUS_LABEL, TRAINER_STATUS_VARIANT } from "../constants/trainers";
import { TrainerRowActions } from "./trainer-row-actions";
import type { ClubTrainer } from "../types/trainer-types";

export function TrainerTable({ trainers }: { trainers: ClubTrainer[] }) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">
          مربیان باشگاه ({toPersianDigits(trainers.length)})
        </CardTitle>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>مربی</TableHead>
              <TableHead>شاگردان</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>شروع همکاری</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainers.map((trainer) => (
              <TableRow key={trainer.membershipId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {trainer.avatarUrl && (
                        <AvatarImage src={trainer.avatarUrl} alt={trainer.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {trainer.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{trainer.name}</p>
                      {trainer.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {trainer.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {toPersianDigits(trainer.athleteCount)} نفر
                </TableCell>
                <TableCell>
                  <Badge variant={TRAINER_STATUS_VARIANT[trainer.status]}>
                    {TRAINER_STATUS_LABEL[trainer.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatPersianDate(new Date(trainer.joinedAt))}
                </TableCell>
                <TableCell>
                  <TrainerRowActions trainer={trainer} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
