import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function transpile(relative) {
  const sourcePath = fileURLToPath(new URL(relative, import.meta.url));
  return ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const chargeUrl = `data:text/javascript;base64,${Buffer.from(transpile("../src/lib/charge-face.ts")).toString("base64")}`;
const boardJs = transpile("../src/lib/stall-board.ts").replaceAll(
  'from "./charge-face"',
  `from "${chargeUrl}"`,
);
const board = await import(`data:text/javascript;base64,${Buffer.from(boardJs).toString("base64")}`);

const now = Date.parse("2026-11-14T18:00:00.000Z");

function ticket(overrides = {}) {
  return {
    id: "ord_board",
    status: "payment_pending",
    paymentMethod: "codi",
    lastPaymentProvider: null,
    lastPaymentDemo: false,
    creditCents: 0,
    paidCents: 0,
    qrId: null,
    qrString: null,
    qrExpiresAt: null,
    ...overrides,
  };
}

test("el día del mostrador es America/Mexico_City", () => {
  const bounds = board.mexicoCityDayBounds(new Date("2026-11-14T17:41:00.000Z"));
  assert.equal(bounds.label, "2026-11-14");
  assert.equal(bounds.startIso, "2026-11-14T06:00:00.000Z");
  assert.equal(bounds.endIso, "2026-11-15T06:00:00.000Z");
});

test("el ticket CoDi es el que tiene QR real, no el fiado", () => {
  const fiado = ticket({ id: "fiado", status: "confirmed", paymentMethod: null, creditCents: 2000 });
  const codi = ticket({ id: "codi", qrId: "AB12CD34EF", qrString: "{\"TYP\":1}" });
  assert.equal(board.pickCodiTicket([fiado, codi])?.id, "codi");
  assert.equal(board.hasRealCodiQr({ qrId: "local-preview", qrString: "local-preview" }), false);
  assert.equal(board.hasRealCodiQr({ qrId: "demo_qr_1", qrString: "{\"demo\":true}" }), false);
});

test("PAGADO solo con pago pey, nunca con demo ni efectivo", () => {
  assert.equal(board.boardWord(ticket({ status: "paid", lastPaymentProvider: "pey" }), now).word, "PAGADO");
  assert.equal(
    board.boardWord(ticket({ status: "paid", paymentMethod: "cash", lastPaymentProvider: "cash" }), now).word,
    "EFECTIVO",
  );
  assert.equal(board.boardWord(ticket({ status: "demo_paid", lastPaymentDemo: true }), now).word, "DEMO");
  assert.notEqual(board.boardWord(ticket({ status: "demo_paid" }), now).word, "PAGADO");
});

test("sin QR real el CoDi se queda en RECHAZADO y no se llama pagado", () => {
  const word = board.boardWord(ticket(), now);
  assert.equal(word.word, "RECHAZADO");
  assert.equal(word.detail, "CoDi no activo.");
  assert.notEqual(word.word, "PRODUCIENDO");
  assert.notEqual(word.word, "PAGADO");
});

test("PRODUCIENDO solo después del pago pey y del arranque de comanda", () => {
  const paid = ticket({ status: "paid", lastPaymentProvider: "pey", paymentMethod: "codi" });
  assert.equal(board.boardWord(paid, now).word, "PAGADO");
  assert.equal(board.boardWord(paid, now, { producing: true }).word, "PRODUCIENDO");
});

test("tardío, vencido y rechazado se leen en el ticket abierto", () => {
  const late = board.boardWord(
    ticket({ qrExpiresAt: new Date(now + 60_000).toISOString(), qrId: "AB12", qrString: "{\"TYP\":1}" }),
    now,
  );
  const expired = board.boardWord(
    ticket({ qrExpiresAt: new Date(now - 1000).toISOString(), qrId: "AB12", qrString: "{\"TYP\":1}" }),
    now,
  );
  const rejected = board.boardWord(ticket(), now, { rejected: true });
  assert.equal(late.word, "TARDÍO");
  assert.equal(expired.word, "VENCIDO");
  assert.equal(rejected.word, "RECHAZADO");
  assert.notEqual(late.word, "PAGADO");
});
