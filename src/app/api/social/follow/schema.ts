import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (currentUid must match callerUid).
export const followBodySchema = z
  .object({
    currentUid: zId,
    targetUid: zId,
  })
  .strict();

export type FollowBody = z.infer<typeof followBodySchema>;
