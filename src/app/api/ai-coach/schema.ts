import { z } from "zod";

// STRIP mode: unknown keys are silently dropped (forward-compat with new client fields).
// Rationale: the AI coach payload is large and client-driven; new fields may be added
// without coordinated server releases. Strict mode would break older servers.

const setSchema = z.object({
  weight: z.number().min(0).max(1e6),
  reps: z.number().min(0).max(1e6),
  completed: z.boolean(),
});

const exerciseSchema = z.object({
  exerciseId: z.string().min(1).max(200),
  exerciseName: z.string().min(1).max(200),
  sets: z.array(setSchema).max(100),
});

const sessionSchema = z.object({
  date: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  exercises: z.array(exerciseSchema).max(50),
  duration: z.number().min(0).max(86400),
  completed: z.boolean(),
});

const personalRecordSchema = z.object({
  exerciseId: z.string().min(1).max(200),
  exerciseName: z.string().min(1).max(200),
  maxWeight: z.number().min(0).max(1e6),
  max1RM: z.number().min(0).max(1e6),
  date: z.string().min(1).max(50),
});

const profileSchema = z.object({
  gender: z.string().nullable(),
  age: z.number().int().min(5).max(120),
  goal: z.string().nullable(),
  fitnessLevel: z.string().nullable(),
  trainingYears: z.number().int().min(0).max(80),
  equipment: z.array(z.string().max(100)).max(50),
  priorityMuscles: z.array(z.string().max(100)).max(50),
  physiqueFocus: z.string(),
  injuries: z.array(z.string().max(100)).max(50),
  medicalCautions: z.array(z.string().max(100)).max(50),
  mobilityLimited: z.boolean(),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionLengthMin: z.number().int().min(10).max(240),
  intensityStyle: z.string(),
  includeCardio: z.boolean(),
  includeWarmup: z.boolean(),
  includeCoreFinisher: z.boolean(),
  bodyFatLevel: z.string().nullable(),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(400),
});

const analyticsSchema = z.object({
  streak: z.number().int().min(0),
  totalWorkouts: z.number().int().min(0),
  totalVolume: z.number().min(0).max(1e12),
  totalDuration: z.number().min(0),
  muscleGroupStats: z
    .array(z.object({ muscle: z.string().max(100), volume: z.number() }))
    .max(20),
  weeklyTonnage: z
    .array(z.object({ week: z.string().max(50), tonnage: z.number() }))
    .max(26),
});

const exerciseRefSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  target: z.string().max(100),
  equipment: z.string().max(100),
  bodyPart: z.string().max(100),
});

export const coachRequestSchema = z
  .object({
    profile: profileSchema,
    recentSessions: z.array(sessionSchema).max(50),
    personalRecords: z.array(personalRecordSchema).max(50),
    analytics: analyticsSchema,
    exercises: z.array(exerciseRefSchema).min(1).max(500),
    userPrompt: z.string().trim().max(1000).optional(),
  })
  .strip();

export type CoachRequest = z.infer<typeof coachRequestSchema>;
