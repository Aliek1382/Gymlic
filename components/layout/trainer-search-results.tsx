"use client";

import { useEffect, useMemo } from "react";
import { Dumbbell, Users } from "lucide-react";

import { useAthletes } from "@/features/athletes";
import { useExercises } from "@/features/exercises";
import { SearchResultGroup, type SearchResultItem } from "./search-result-group";

const RESULT_LIMIT = 5;

// Loaded via next/dynamic only for the trainer role, and only once the
// search is actually opened — otherwise every dashboard page (including
// club/athlete ones that never need athlete/exercise data) would bundle
// this feature code just because it lives in the shared header.
export default function TrainerSearchResults({
  query,
  onSelect,
  onResultCountChange,
}: {
  query: string;
  onSelect: () => void;
  onResultCountChange: (count: number) => void;
}) {
  const athletes = useAthletes();
  const exercises = useExercises();

  const athleteResults: SearchResultItem[] = useMemo(() => {
    if (!query) return [];
    return (athletes.data ?? [])
      .filter((athlete) => athlete.name.toLowerCase().includes(query))
      .slice(0, RESULT_LIMIT)
      .map((athlete) => ({
        id: athlete.id,
        label: athlete.name,
        href: "/athletes",
        icon: Users,
      }));
  }, [query, athletes.data]);

  const exerciseResults: SearchResultItem[] = useMemo(() => {
    if (!query) return [];
    return (exercises.data ?? [])
      .filter(
        (exercise) =>
          exercise.name.toLowerCase().includes(query) ||
          (exercise.nameEn ?? "").toLowerCase().includes(query)
      )
      .slice(0, RESULT_LIMIT)
      .map((exercise) => ({
        id: exercise.id,
        label: exercise.name,
        sublabel: exercise.nameEn ?? undefined,
        href: "/exercises",
        icon: Dumbbell,
      }));
  }, [query, exercises.data]);

  const resultCount = athleteResults.length + exerciseResults.length;

  useEffect(() => {
    onResultCountChange(resultCount);
  }, [resultCount, onResultCountChange]);

  return (
    <>
      {athleteResults.length > 0 && (
        <SearchResultGroup title="ورزشکاران" items={athleteResults} onSelect={onSelect} />
      )}
      {exerciseResults.length > 0 && (
        <SearchResultGroup title="حرکات" items={exerciseResults} onSelect={onSelect} />
      )}
    </>
  );
}
