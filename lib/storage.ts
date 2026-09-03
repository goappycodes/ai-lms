import { r2 } from "@/lib/env";

/**
 * Builds a public URL from a stored object key.
 *
 * Assets store a key, never a URL (see docs/SCHEMA.md). The delivery domain
 * changes when R2 moves to a custom domain and again when the access Worker
 * lands, and both must be an environment change rather than an UPDATE across
 * every asset row.
 */
export function assetUrl(storage: string | null, key: string | null): string | null {
  if (!key) return null;
  if (storage === "local") return `/${key}`;
  if (!r2.publicUrl) return null;
  return `${r2.publicUrl}/${key}`;
}
