/**
 * Database access — node:sqlite (Node 22 built-in).
 * Portable design: SQL stays in a PostgreSQL-compatible subset; swapping to
 * Postgres later means changing this file only (see §25 BUILD_SPEC).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __db?: DatabaseSync };

function dataDir(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDb(): DatabaseSync {
  if (globalForDb.__db) return globalForDb.__db;
  const file = path.join(dataDir(), "offergraph.db");
  const db = new DatabaseSync(file);
  const schema = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  globalForDb.__db = db;
  return db;
}

// node:sqlite returns rows with NULL prototypes. React Server Components refuse
// to serialize null-prototype objects into Client Components, so every row is
// copied into a plain object here — once, centrally.
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function q<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number | null | bigint)[]
): T[] {
  return (getDb().prepare(sql).all(...params) as unknown[]).map((r) => plain<T>(r));
}

export function q1<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number | null | bigint)[]
): T | null {
  const row = getDb().prepare(sql).get(...params) as unknown;
  return row === undefined ? null : plain<T>(row);
}

export function run(
  sql: string,
  ...params: (string | number | null | bigint)[]
): { changes: number; lastInsertRowid: number | bigint } {
  return getDb().prepare(sql).run(...params) as {
    changes: number;
    lastInsertRowid: number | bigint;
  };
}

/** Deterministic-ish ids: prefix_000123 */
let counterCache: Record<string, number> = {};
export function nextId(prefix: string, table: string, column = "id"): string {
  if (counterCache[prefix] === undefined) {
    const row = q1<{ m: number | null }>(
      `SELECT MAX(CAST(SUBSTR(${column}, ${prefix.length + 2}) AS INTEGER)) AS m FROM ${table} WHERE ${column} LIKE ?`,
      `${prefix}_%`
    );
    counterCache[prefix] = row?.m ?? 0;
  }
  counterCache[prefix] += 1;
  return `${prefix}_${String(counterCache[prefix]).padStart(4, "0")}`;
}

export function resetIdCache() {
  counterCache = {};
}

export function nowIso(): string {
  return new Date().toISOString();
}
