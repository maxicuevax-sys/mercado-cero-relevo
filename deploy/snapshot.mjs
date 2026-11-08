/** Consistent SQLite snapshot, including WAL. Requires an explicit output path. */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const source = process.env.DATABASE_PATH;
const target = process.argv[2];
if (!source || !target) throw new Error("Set DATABASE_PATH and pass a new snapshot output path.");
if (path.resolve(source) === path.resolve(target) || fs.existsSync(target)) {
  throw new Error("Snapshot destination must be a new file distinct from the database.");
}
fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
const database = new DatabaseSync(source, { readOnly: true });
try {
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec(`VACUUM INTO '${path.resolve(target).replaceAll("'", "''")}'`);
} finally {
  database.close();
}
const snapshot = new DatabaseSync(target, { readOnly: true });
try {
  const result = snapshot.prepare("PRAGMA integrity_check").get();
  if (result.integrity_check !== "ok") throw new Error("Snapshot integrity check failed.");
} finally {
  snapshot.close();
}
console.log("SQLite snapshot verified.");
