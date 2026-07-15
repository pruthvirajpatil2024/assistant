import { streamInterviewAnswer } from "./_groq";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { question } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const stream = await streamInterviewAnswer(question);
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
