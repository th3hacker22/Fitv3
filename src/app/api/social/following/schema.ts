import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// GET query schema. includeProfiles is coerced from "true"/"false" string.
export const followingQuerySchema = z
  .object({
    uid: zId,
    includeProfiles: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict();

export type FollowingQuery = z.infer<typeof followingQuerySchema>;
