import { randomUUID } from "node:crypto";

// Short, url-safe, prefixed ids: e.g. "crs_ab12cd34ef56".
export function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "course";
}

export function nowIso(): string {
  return new Date().toISOString();
}
