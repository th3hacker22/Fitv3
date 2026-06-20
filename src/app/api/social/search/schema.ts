import { z } from "zod";

// GET query schema. q is optional — empty/missing q returns [] (current behavior).
export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
  })
  .strict();

export type SearchQuery = z.infer<typeof searchQuerySchema>;
