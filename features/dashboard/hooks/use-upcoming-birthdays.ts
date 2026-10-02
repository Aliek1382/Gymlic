"use client";

import { useTrainerDashboardSlice } from "./use-trainer-dashboard";

export function useUpcomingBirthdays() {
  return useTrainerDashboardSlice((data) => data.birthdays);
}
