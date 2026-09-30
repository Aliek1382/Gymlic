"use client";

import { useQuery } from "@tanstack/react-query";

import { getMyPoints } from "../services/points-service";

export function useMyPoints() {
  return useQuery({
    queryKey: ["points", "me"],
    queryFn: getMyPoints,
  });
}
