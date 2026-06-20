import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (postId ownership implicit via kudos unique constraint).
export const kudosBodySchema = z
  .object({
    postId: zId,
  })
  .strict();

export type KudosBody = z.infer<typeof kudosBodySchema>;
