import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRICT mode: identity-bearing route (userId impersonation check follows in handler).
export const joinBodySchema = z
  .object({
    userId: zId,
    userName: zDisplayName,
    userPhotoURL: zOptionalUrl,
  })
  .strict();

export type JoinBody = z.infer<typeof joinBodySchema>;
