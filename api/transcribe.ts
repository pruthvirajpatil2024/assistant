import { transcribeAudio } from "./_groq";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const mimeType = req.headers.get("content-type") || "audio/webm";
    const audioData = await req.arrayBuffer();
    if (audioData.byteLength === 0) {
      return new Response(JSON.stringify({ error: "Empty audio" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const text = await transcribeAudio(audioData, mimeType);
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
