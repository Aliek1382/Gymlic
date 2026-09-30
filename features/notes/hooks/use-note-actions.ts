"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createNote, deleteNote, updateNote } from "../services/note-service";

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["notes"] });
}

export function useCreateNote() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: createNote, onSuccess: invalidate });
}

export function useUpdateNote() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: updateNote, onSuccess: invalidate });
}

export function useDeleteNote() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deleteNote, onSuccess: invalidate });
}
