export interface Note {
  id: string;
  /** null = a general note, not about any one athlete. */
  athleteId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}
