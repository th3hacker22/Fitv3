import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing (uid must match callerUid).
export const profileBodySchema = z
  .object({
    uid: zId,
    displayName: zDisplayName,
    photoURL: zOptionalUrl,
  })
  .strict();

export type ProfileBody = z.infer<typeof profileBodySchema>;
