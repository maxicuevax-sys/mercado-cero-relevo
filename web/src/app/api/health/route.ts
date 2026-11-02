import { connection } from "next/server";

/**
 * Identidad del proceso que sirve la app.
 *
 * El harness compara `buildSha` con `gitAtStart.sha` antes de correr gates de
 * runtime. Si no coincide, la evidencia no es de este árbol y se rechaza.
 * No expone secretos ni datos del negocio.
 */
export async function GET() {
  await connection();
  return Response.json(
    {
      ok: true,
      buildSha: process.env.BUILD_SHA ?? "unknown",
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
