import { z } from "zod";

// Shared by join, leaderboard, progress routes (dynamic [challengeId] segment).
export const challengeIdParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s\x00-\x1f\x7f]+$/u);
