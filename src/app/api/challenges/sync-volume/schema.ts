import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId must match callerUid).
export const syncVolumeBodySchema = z
  .object({
    userId: zId,
    totalVolume: z.number().min(0).max(1e9), // replaces the runtime clamp
    sessionId: zId.optional(),
  })
  .strict();

export type SyncVolumeBody = z.infer<typeof syncVolumeBodySchema>;
