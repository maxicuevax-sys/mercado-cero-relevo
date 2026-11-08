import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createPilotIdentity } from "../../src/lib/auth/pilot-identity";

let server: Server;
let identity: Awaited<ReturnType<typeof createPilotIdentity>>;
let baseURL: string;
let root: string;

test.beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "mc-browser-identity-"));
  server = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/api/auth/")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const response = await identity.auth.handler(new Request(baseURL + req.url, {
          method: req.method,
          headers,
          ...(body.length ? { body } : {}),
        }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => { if (key !== "set-cookie") res.setHeader(key, value); });
        res.setHeader("Set-Cookie", response.headers.getSetCookie());
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      // Disposable semantics fixture, not a product screen or visual proposal.
      res.end(`<!doctype html><html lang="es"><head><title>Prueba técnica de identidad</title></head>
        <body><main><h1>Prueba técnica de Mercado Cero</h1><p>Solo datos ficticios en un servidor temporal.</p>
        <form><label for="name">Nombre</label><input id="name" name="name" required autocomplete="name">
        <label for="email">Correo electrónico</label><input id="email" name="email" type="email" required autocomplete="email">
        <label for="password">Contraseña</label><input id="password" name="password" type="password" minlength="12" required autocomplete="new-password">
        <button>Crear cuenta de prueba</button></form><p role="status" aria-live="polite"></p></main>
        <script>document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();
        const body=Object.fromEntries(new FormData(e.target));const r=await fetch('/api/auth/sign-up/email',
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        document.querySelector('[role=status]').textContent=r.ok?'Cuenta temporal creada':'No se pudo crear';});</script></body></html>`);
    } catch {
      res.statusCode = 500;
      res.end("Test fixture failed");
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing temporary loopback port");
  baseURL = `http://127.0.0.1:${address.port}`;
  identity = await createPilotIdentity({ directory: root, baseURL, secret: randomBytes(48).toString("base64url"), allowSignUp: true });
});

test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  identity?.close();
  if (root && path.basename(root).startsWith("mc-browser-identity-")) rmSync(root, { recursive: true, force: true });
});

test("keyboard registration, real cookie session, axe and logout in Chromium", async ({ page, context }) => {
  await page.goto(baseURL);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByLabel("Nombre", { exact: true }).fill("Juez temporal");
  await page.getByLabel("Correo electrónico").fill("browser-judge@example.test");
  await page.getByLabel("Contraseña").fill("Prueba-browser-temporal-2026");
  await page.getByRole("button", { name: "Crear cuenta de prueba" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Cuenta temporal creada");
  const cookies = await context.cookies();
  expect(cookies.some(cookie => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
  const session = await context.request.get(baseURL + "/api/auth/get-session");
  expect((await session.json()).user.email).toBe("browser-judge@example.test");
  const result = await context.request.post(baseURL + "/api/auth/sign-out", { data: {}, headers: { Origin: baseURL } });
  expect(result.status()).toBe(200);
  expect(await (await context.request.get(baseURL + "/api/auth/get-session")).json()).toBeNull();
});
