import { transcribeAudio } from "@/lib/voice";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "Falta el audio." }, { status: 400 });
    }

    if (audio.size > 12 * 1024 * 1024) {
      return Response.json({ error: "El audio es demasiado grande." }, { status: 413 });
    }

    const text = await transcribeAudio(audio);
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo transcribir.";
    return Response.json({ error: message }, { status: 500 });
  }
}
