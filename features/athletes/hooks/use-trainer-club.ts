"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerClub } from "../services/athlete-service";

export function useTrainerClub() {
  return useQuery({
    queryKey: ["athletes", "trainer-club"],
    queryFn: getTrainerClub,
  });
}
