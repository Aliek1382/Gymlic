"use client";

import { useQuery } from "@tanstack/react-query";

import { getMyProfile } from "../services/auth-service";

export function useProfile() {
  return useQuery({
    queryKey: ["auth", "profile"],
    queryFn: getMyProfile,
  });
}
