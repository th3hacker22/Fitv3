import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (post ownership check in handler).
export const postDeleteSchema = z
  .object({
    postId: zId,
  })
  .strict();

export type PostDeleteBody = z.infer<typeof postDeleteSchema>;
