import { test, expect, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});

async function ownGuest(context: BrowserContext, origin: string) {
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  const access = await context.request.post("/api/access/guest", { headers: { Origin: origin }, data: {} });
  expect(access.status()).toBe(200);
  const profile = await context.request.put("/api/business-profile", { headers: { Origin: origin }, data: { businessType: "general" } });
  expect(profile.status()).toBe(200);
}

test("companion preferences synchronize tabs and preserve unrelated changes", async ({ page, context, baseURL }) => {
  await ownGuest(context, baseURL!);
  await page.goto("/ajustes");
  await page.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
  const suggestions = page.locator("#companion-preferences button").filter({ hasText: "Sugerencias para revisar" });
  await expect(suggestions).toHaveAttribute("aria-pressed", "true");
  const peer = await context.newPage();
  try {
    await peer.goto("/ajustes");
    await peer.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
    const peerSuggestions = peer.locator("#companion-preferences button").filter({ hasText: "Sugerencias para revisar" });
    await peerSuggestions.click();
    await expect(peerSuggestions).toHaveAttribute("aria-pressed", "false");
    await expect(suggestions).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("group", { name: "Tamaño del texto", exact: true }).getByRole("button", { name: "Muy grande", exact: true }).click();
    await expect(peerSuggestions).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await page.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
    await expect(suggestions).toHaveAttribute("aria-pressed", "false");
  } finally {
    await peer.close();
  }
});

test("failed settings status has an error and retries the actual API", async ({ page, context, baseURL }) => {
  await ownGuest(context, baseURL!);
  // Failure injection only: no synthetic success response or provider request.
  let fail = true;
  await page.route("**/api/pey/status", route => fail ? route.abort("failed") : route.continue());
  await page.goto("/ajustes");
  const error = page.locator("#mc-settings-pey-error");
  await expect(error).toContainText("No pudimos consultar el estado");
  const security = page.locator(".mc-settings-group details").filter({ hasText: "Seguridad" });
  await security.locator("summary").click();
  await expect(security).not.toContainText("Consultando bitácora");
  await expect(security).toContainText("No disponible");
  fail = false;
  const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/pey/status" && r.request().method() === "GET");
  await page.getByRole("button", { name: "Reintentar consulta", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(error).toHaveCount(0);
  await expect(security).toContainText("Integridad de bitácora SHA-256: OK");
});

test("help clears stale search answers and opens guide and local assistant FAQ", async ({ page, context, baseURL }) => {
  await ownGuest(context, baseURL!);
  await page.goto("/ayuda");
  await page.locator(".mc-help-topics").getByRole("button", { name: "Registrar una venta", exact: true }).click();
  await expect(page.locator(".mc-help-answer")).toBeVisible();
  await page.getByPlaceholder("Buscar ayuda", { exact: true }).fill("QA-NO-MATCH");
  await expect(page.getByText("0 temas encontrados.", { exact: true })).toBeVisible();
  await expect(page.locator(".mc-help-answer")).toHaveCount(0);
  const guide = page.locator("#mc-help-guide");
  await page.getByRole("link", { name: "Ver guía", exact: true }).click();
  await expect(guide).toHaveAttribute("open", "");
  await guide.locator("summary").click();
  await page.goto("/ajustes");
  await page.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
  await page.getByRole("switch", { name: /Asistente opcional/ }).click();
  await page.goto("/ayuda");
  const assistant = page.locator("#asistente");
  await expect(assistant.locator(".mc-assistant-body")).toBeVisible();
  await expect(assistant).toContainText("Respuestas de la guía local");
  await assistant.getByRole("button", { name: "¿Cómo van mis ventas?", exact: true }).click();
  await expect(assistant.locator(".mc-assistant-answer")).toContainText("Una venta pendiente o demo no significa dinero recibido");
  await assistant.getByLabel("Escribe tu pregunta", { exact: true }).fill("QA tema que no existe");
  await assistant.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(assistant.locator(".mc-assistant-answer")).toContainText("no es un chat en vivo");
  await assistant.getByRole("link", { name: "Ver preguntas frecuentes", exact: true }).click();
  await expect(guide).toHaveAttribute("open", "");
  await expect(page.locator("#mc-ayuda-faq-title")).toBeFocused();
});
