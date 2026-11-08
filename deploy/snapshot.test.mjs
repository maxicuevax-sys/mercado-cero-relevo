import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const command = fileURLToPath(new URL("./snapshot.mjs", import.meta.url));

test("a live WAL snapshot restores committed rows and refuses overwrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-snapshot-"));
  const source = path.join(dir, "source.db");
  const target = path.join(dir, "snapshot's.db");
  const database = new DatabaseSync(source);
  try {
    database.exec("PRAGMA journal_mode=WAL; CREATE TABLE entries(id INTEGER PRIMARY KEY, value TEXT);");
    database.prepare("INSERT INTO entries(value) VALUES (?)").run("committed in WAL");
    assert.ok(fs.statSync(source + "-wal").size > 0);
    const run = () => spawnSync(process.execPath, [command, target], {
      env: { ...process.env, DATABASE_PATH: source }, encoding: "utf8",
    });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const snapshot = new DatabaseSync(target, { readOnly: true });
    try {
      assert.equal(snapshot.prepare("SELECT value FROM entries").get().value, "committed in WAL");
      assert.equal(snapshot.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally {
      snapshot.close();
    }
    const before = fs.readFileSync(target);
    assert.notEqual(run().status, 0);
    assert.deepEqual(fs.readFileSync(target), before);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM entries").get().count, 1);
  } finally {
    database.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
