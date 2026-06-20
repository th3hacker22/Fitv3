import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// GET query schema for progress lookup.
export const progressQuerySchema = z
  .object({
    userId: zId,
  })
  .strict();

export type ProgressQuery = z.infer<typeof progressQuerySchema>;
