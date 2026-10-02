"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMyResume,
  getTrainerResume,
  requestVerification,
  saveMyResume,
  uploadCertificate,
} from "../services/trainer-resume-service";

const resumeKey = ["trainer-resume"] as const;

export function useMyResume() {
  return useQuery({ queryKey: [...resumeKey, "mine"], queryFn: getMyResume });
}

export function useSaveResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMyResume,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumeKey }),
  });
}

export function useUploadCertificate() {
  return useMutation({ mutationFn: uploadCertificate });
}

export function useTrainerResume(trainerId: string | null) {
  return useQuery({
    queryKey: [...resumeKey, "view", trainerId],
    queryFn: () => getTrainerResume(trainerId as string),
    enabled: !!trainerId,
  });
}

export function useRequestVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestVerification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumeKey }),
  });
}
