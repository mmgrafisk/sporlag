/**
 * Database access — node:sqlite (Node 22 built-in).
 * Portable design: SQL stays in a PostgreSQL-compatible subset; swapping to
 * Postgres later means changing this file only (see §25 BUILD_SPEC).
 *
 * Performance:
 *  - WAL + NORMAL sync + mmap + memory temp store (one-time PRAGMAs)
 *  - prepared-statement cache (compile SQL once per process)
 *  - nested transactions so multi-statement writes fsync once, not per row
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

type Prepared = ReturnType<DatabaseSync["prepare"]>;

const globalForDb = globalThis as unknown as {
  __db?: DatabaseSync;
  __stmts?: Map<string, Prepared>;
  __txDepth?: number;
};

function dataDir(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function migrateCompanies(db: DatabaseSync) {
  const cols = (db.prepare("PRAGMA table_info(companies)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("website")) db.exec("ALTER TABLE companies ADD COLUMN website TEXT");
  if (!cols.includes("logo_path")) db.exec("ALTER TABLE companies ADD COLUMN logo_path TEXT");
  const known: Record<string, string> = {
    telmore: "https://telmore.dk",
    mofibo: "https://mofibo.com",
    yousee: "https://yousee.dk",
    norlys: "https://norlys.dk",
    "fitness-world": "https://fitnessworld.com",
    elgiganten: "https://elgiganten.dk",
    "call-me": "https://callme.dk",
    telia: "https://telia.dk",
    "3": "https://3.dk",
    "tv-2-play": "https://tv2play.dk",
    viaplay: "https://viaplay.com",
    blockbuster: "https://blockbuster.dk",
    netto: "https://netto.dk",
    bilka: "https://bilka.dk",
    coop: "https://coop.dk",
    dsb: "https://dsb.dk",
    scandlines: "https://scandlines.dk",
    tryg: "https://tryg.dk",
    codan: "https://codan.dk",
    power: "https://power.dk",
    sats: "https://sats.dk",
    matas: "https://matas.dk",
  };
  const rows = db.prepare("SELECT id, slug, website, logo_path FROM companies").all() as {
    id: string; slug: string; website: string | null; logo_path: string | null;
  }[];
  const upd = db.prepare("UPDATE companies SET website = ?, logo_path = ? WHERE id = ?");
  for (const r of rows) {
    const website = r.website || known[r.slug] || null;
    let logo = r.logo_path;
    if (!logo) {
      for (const ext of ["png", "svg", "webp", "jpg"]) {
        if (fs.existsSync(path.join(process.cwd(), "public", "logos", `${r.slug}.${ext}`))) {
          logo = `/logos/${r.slug}.${ext}`;
          break;
        }
      }
    }
    if (website !== r.website || logo !== r.logo_path) upd.run(website, logo, r.id);
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb.__db) return globalForDb.__db;
  const file = path.join(dataDir(), "offergraph.db");
  const db = new DatabaseSync(file);

  // Connection PRAGMAs — cheap, per-connection. WAL is persistent on the file.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -8000;
    PRAGMA mmap_size = 67108864;
    PRAGMA wal_autocheckpoint = 1000;
  `);

  const schema = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  migrateCompanies(db);

  globalForDb.__db = db;
  globalForDb.__stmts = new Map();
  globalForDb.__txDepth = 0;
  return db;
}

function stmts(): Map<string, Prepared> {
  getDb();
  return globalForDb.__stmts!;
}

function prepare(sql: string): Prepared {
  const cache = stmts();
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = getDb().prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
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
  return (prepare(sql).all(...params) as unknown[]).map((r) => plain<T>(r));
}

export function q1<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number | null | bigint)[]
): T | null {
  const row = prepare(sql).get(...params) as unknown;
  return row === undefined || row === null ? null : plain<T>(row);
}

export function run(
  sql: string,
  ...params: (string | number | null | bigint)[]
): { changes: number; lastInsertRowid: number | bigint } {
  return prepare(sql).run(...params) as {
    changes: number;
    lastInsertRowid: number | bigint;
  };
}

/**
 * Nested-safe write transaction. SQLite fsyncs once per COMMIT — wrapping
 * multi-row writes (extraction persist, seed, review fan-out) is a 10–100×
 * speedup versus the implicit per-statement transaction.
 */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  const depth = globalForDb.__txDepth ?? 0;
  if (depth === 0) db.exec("BEGIN IMMEDIATE");
  globalForDb.__txDepth = depth + 1;
  try {
    const result = fn();
    globalForDb.__txDepth = depth;
    if (depth === 0) db.exec("COMMIT");
    return result;
  } catch (err) {
    globalForDb.__txDepth = depth;
    if (depth === 0) {
      try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
    }
    throw err;
  }
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

/** Safe JSON parse for TEXT columns that store structured snapshots. */
export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
