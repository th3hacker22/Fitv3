import { z } from "zod";
import { zId } from "@/lib/apiSchemas";

// STRIP mode for POST (content route — forward-compat).
export const commentCreateSchema = z
  .object({
    postId: zId,
    text: z.string().trim().min(1).max(500), // preserves current 500-char cap
  })
  .strip();

// STRICT mode for DELETE (identity-bearing — commentId ownership check follows).
export const commentDeleteSchema = z
  .object({
    postId: zId,
    commentId: zId,
  })
  .strict();

// GET query schema.
export const commentsQuerySchema = z
  .object({
    postId: zId,
  })
  .strict();

export type CommentCreateBody = z.infer<typeof commentCreateSchema>;
export type CommentDeleteBody = z.infer<typeof commentDeleteSchema>;
