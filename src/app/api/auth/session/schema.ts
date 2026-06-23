import { z } from "zod";

// STRICT mode: only idToken accepted.
export const sessionPostSchema = z
  .object({
    idToken: z.string().min(1).max(4096),
  })
  .strict();

export type SessionPostBody = z.infer<typeof sessionPostSchema>;
