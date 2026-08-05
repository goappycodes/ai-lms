import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/env";

// Reuse one connection across Next dev hot-reloads (avoids re-opening / locks).
const g = globalThis as unknown as { __aivedaDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "aiveda.db"));
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  return db;
}

export function getDb(): DatabaseSync {
  if (!g.__aivedaDb) g.__aivedaDb = open();
  return g.__aivedaDb;
}
