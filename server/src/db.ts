import { createClient, type Client, type InValue } from "@libsql/client";

/**
 * libSQL = SQLite. Locally it opens a plain file; on Vercel point
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN at a Turso database.
 * Table and column names match the original SQLAlchemy schema, so an existing
 * sleepsync.db can be reused by setting TURSO_DATABASE_URL=file:<path>.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR NOT NULL,
    color           VARCHAR DEFAULT 'purple',
    start_h         FLOAT NOT NULL DEFAULT 9,
    dur_h           FLOAT NOT NULL DEFAULT 1,
    day             INTEGER DEFAULT 0,
    location        VARCHAR,
    description     VARCHAR,
    priority        VARCHAR DEFAULT 'medium',
    task_type       VARCHAR DEFAULT 'flexible',
    fixed_time      VARCHAR,
    repeat          JSON,
    repeat_group_id VARCHAR,
    is_completed    BOOLEAN DEFAULT 0,
    is_missed       BOOLEAN DEFAULT 0,
    miss_count      INTEGER DEFAULT 0,
    complete_count  INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT (CURRENT_TIMESTAMP)
  )`,
  `CREATE TABLE IF NOT EXISTS sleep_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date DATE,
    bedtime     VARCHAR DEFAULT '23:00',
    wake_time   VARCHAR DEFAULT '07:00',
    goal_hours  FLOAT DEFAULT 8.0,
    total_hours FLOAT,
    score       INTEGER,
    deep_mins   INTEGER,
    rem_mins    INTEGER,
    light_mins  INTEGER
  )`,
];

let client: Client | undefined;
let ready: Promise<void> | undefined;

function getClient(): Client {
  client ??= createClient({
    url: process.env["TURSO_DATABASE_URL"] || "file:./data/sleepsync.db",
    authToken: process.env["TURSO_AUTH_TOKEN"],
  });
  return client;
}

/** Lazily creates tables once per process (cheap no-op after the first call). */
export async function db(): Promise<Client> {
  const c = getClient();
  ready ??= c.batch(SCHEMA, "write").then(() => undefined);
  await ready;
  return c;
}

export type Row = Record<string, unknown>;

export async function query(sql: string, args: InValue[] = []): Promise<Row[]> {
  const res = await (await db()).execute({ sql, args });
  return res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])));
}

export async function run(sql: string, args: InValue[] = []) {
  return (await db()).execute({ sql, args });
}

/** Test helper: point at a fresh in-memory database. */
export function resetDbForTests(): void {
  client = createClient({ url: ":memory:" });
  ready = undefined;
}
