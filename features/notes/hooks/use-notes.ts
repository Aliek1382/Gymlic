"use client";

import { useQuery } from "@tanstack/react-query";

import { listNotes } from "../services/note-service";

/** Trainer side only; null `athleteId` = the general notes. */
export function useNotes(athleteId: string | null) {
  return useQuery({
    queryKey: ["notes", athleteId],
    queryFn: () => listNotes(athleteId),
  });
}
