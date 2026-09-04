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

// ---------------------------------------------------------- provisioning ----
// Usernames are how people sign in and are read aloud from a slip of paper, so
// they are restricted to characters that survive being spoken and retyped: no
// spaces, no case sensitivity to get wrong, nothing a phone keyboard hides.
const username = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use lowercase letters, numbers, dots, dashes or underscores");

const fullName = z.string().min(1).max(120);

export const schoolCreate = z.object({
  name: z.string().min(2).max(160),
  district: z.string().max(80).optional(),
  code: z.string().max(40).optional(),
  username,
  email: z.string().email().max(160).optional(),
});

export const schoolUpdate = z
  .object({
    name: z.string().min(2).max(160).optional(),
    // Nullable as well as optional: undefined leaves the field alone, null
    // clears it. The two have to stay distinguishable all the way to the SQL.
    district: z.string().max(80).nullable().optional(),
    code: z.string().max(40).nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const teacherCreate = z.object({
  schoolId: z.string().optional(),
  fullName,
  username,
  email: z.string().email().max(160).optional(),
  classIds: z.array(z.string()).max(20).optional(),
});

export const classCreate = z.object({
  schoolId: z.string().optional(),
  name: z.string().min(1).max(40),
  level: z.number().int().min(5).max(12),
  academicYear: z.string().min(4).max(12).default("2026-27"),
});

export const studentCreate = z.object({
  fullName,
  username,
});

export const teacherAssign = z.object({
  teacherUserId: z.string().min(1),
});

export const userUpdate = z.object({
  fullName: fullName.optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
