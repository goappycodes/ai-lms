import { z } from "zod";

export const courseCreate = z.object({
  title: z.string().min(2).max(120),
  subtitle: z.string().max(200).optional(),
  audience: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  accent: z.string().max(200).optional(),
});

export const courseUpdate = z.object({
  title: z.string().min(2).max(120).optional(),
  subtitle: z.string().max(200).nullable().optional(),
  audience: z.string().max(80).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  accent: z.string().max(200).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  position: z.number().int().optional(),
});

export const chapterCreate = z.object({ title: z.string().min(1).max(120) });
export const chapterUpdate = z.object({
  title: z.string().min(1).max(120).optional(),
  position: z.number().int().optional(),
});

export const lessonCreate = z.object({
  title: z.string().min(1).max(160),
  covers: z.string().max(1000).optional(),
  tools: z.string().max(200).optional(),
  durationMin: z.number().int().min(0).max(600).optional(),
});
export const lessonUpdate = z.object({
  title: z.string().min(1).max(160).optional(),
  covers: z.string().max(1000).nullable().optional(),
  tools: z.string().max(200).nullable().optional(),
  durationMin: z.number().int().min(0).max(600).optional(),
});

// Reordering is its own operation: positions are unique per course, so they
// have to move together rather than one row at a time.
export const lessonReorder = z.object({
  lessonIds: z.array(z.string()).min(1).max(200),
});

export const certificateUpsert = z.object({
  title: z.string().max(120).optional(),
  issuer: z.string().max(120).optional(),
  partner: z.string().max(120).optional(),
  signature_name: z.string().max(120).nullable().optional(),
  signature_title: z.string().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
});
