import { z } from "zod";
import { zId, zDisplayName, zOptionalUrl } from "@/lib/apiSchemas";

// STRIP mode: content route. Author identity is verified against callerUid in handler.
export const feedPostSchema = z
  .object({
    authorUid: zId,
    authorName: zDisplayName,
    authorPhotoURL: zOptionalUrl,
    workoutTitle: z.string().trim().min(1).max(100),
    duration: z.number().int().min(0).max(86400), // max 24h
    totalVolume: z.number().min(0).max(1e9),
    exercisesCount: z.number().int().min(0).max(100),
  })
  .strip();

export type FeedPostBody = z.infer<typeof feedPostSchema>;
