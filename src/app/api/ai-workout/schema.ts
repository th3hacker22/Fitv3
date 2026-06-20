import { z } from "zod";

// STRICT mode: unknown keys (esp. `prompt`, `systemInstruction`) → 400.
// Rationale: this route interpolates fields into an LLM prompt. The strict schema
// is the declarative guard that replaces the manual `if (body.prompt !== undefined)` check.

export const structuredRequestBodySchema = z
  .object({
    goal: z.string().max(200).nullable().optional(),
    age: z.number().int().min(5).max(120).optional(),
    gender: z.string().max(50).nullable().optional(),
    fitnessLevel: z.string().max(50).nullable().optional(),
    equipment: z.array(z.string().max(100)).max(50).optional(),
    selectedMuscles: z.array(z.string().max(100)).max(50).optional(),
    // NOTE: `prompt` and `systemInstruction` are deliberately absent → .strict() rejects them.
  })
  .strict();

export type StructuredRequestBody = z.infer<typeof structuredRequestBodySchema>;
