"use client";

import { useQuery } from "@tanstack/react-query";

import { listMySessionPackages } from "../services/session-package-service";

export function useMySessionPackages() {
  return useQuery({
    queryKey: ["session-packages", "mine"],
    queryFn: listMySessionPackages,
  });
}
