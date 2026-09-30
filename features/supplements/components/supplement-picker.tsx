"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMING_OPTIONS } from "../constants";
import { useRecordSupplementUsage } from "../hooks/use-record-supplement-usage";
import { useSupplementsForPicker } from "../hooks/use-supplements-for-picker";
import type { SupplementPlanItemInput, SupplementTiming } from "../types/supplement-types";

/** Picks a supplement from the library with its dose and time of day, and hands the line to the plan being built. */
export function SupplementPicker({
  onAdd,
}: {
  onAdd: (item: SupplementPlanItemInput) => void;
}) {
  const supplements = useSupplementsForPicker();
  const recordUsage = useRecordSupplementUsage();

  const [supplementId, setSupplementId] = useState("");
  const [dose, setDose] = useState("");
  const [timing, setTiming] = useState<SupplementTiming | "">("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  const selected = supplements.data?.find((item) => item.id === supplementId);
  // A custom time is the whole point of "custom"; for before/after workout it
  // is optional and only decides when the reminder fires.
  const needsTime = timing === "custom";
  const offersTime = timing === "custom" || timing === "before_workout" || timing === "after_workout";

  const ready = selected && dose.trim() !== "" && timing !== "" && (!needsTime || time !== "");

  function handleAdd() {
    if (!selected || timing === "") return;

    onAdd({
      supplementId: selected.id,
      supplementName: selected.name,
      dose: dose.trim(),
      timing,
      customTime: offersTime && time ? time : null,
      note: note.trim() || null,
    });
    recordUsage.mutate(selected.id);

    setSupplementId("");
    setDose("");
    setTiming("");
    setTime("");
    setNote("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">انتخاب مکمل از کتابخانه</p>

      <Select value={supplementId} onValueChange={setSupplementId}>
        <SelectTrigger className="w-full justify-start">
          <SelectValue placeholder="انتخاب مکمل..." className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          {supplements.data?.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
              {item.nameEn ? ` / ${item.nameEn}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          maxLength={100}
          placeholder="دوز، مثلاً ۵ گرم یا ۲ کپسول"
        />
        <Select value={timing} onValueChange={(value) => setTiming(value as SupplementTiming)}>
          <SelectTrigger className="w-full justify-start">
            <SelectValue placeholder="زمان مصرف" className="min-w-0 truncate" />
          </SelectTrigger>
          <SelectContent>
            {TIMING_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {offersTime && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              type="time"
              dir="ltr"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="ساعت مصرف"
              className="w-36 text-center"
            />
            <span className="text-xs text-muted-foreground">
              {needsTime ? "ساعت مصرف" : "ساعت یادآوری (اختیاری)"}
            </span>
          </div>
          {!needsTime && (
            <p className="text-xs leading-5 text-muted-foreground">
              زمان تمرین ورزشکار مشخص نیست؛ بدون ساعت، برای این مکمل یادآوری ارسال نمی‌شود.
            </p>
          )}
        </div>
      )}

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={255}
        placeholder="توضیح (اختیاری)، مثلاً با آب فراوان"
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!ready}
        onClick={handleAdd}
        className="w-full"
      >
        <Plus />
        افزودن به برنامه
      </Button>
    </div>
  );
}
