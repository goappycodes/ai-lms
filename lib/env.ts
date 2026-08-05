import path from "node:path";

export const DATA_DIR =
  process.env.DATA_DIR || path.join(process.cwd(), "data");

export const r2 = {
  accountId: process.env.R2_ACCOUNT_ID || "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  bucket: process.env.R2_BUCKET || "",
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
};

export function r2Configured(): boolean {
  return Boolean(
    r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket && r2.publicUrl
  );
}

export function dbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_DB_HOST && process.env.SUPABASE_DB_PASSWORD);
}
