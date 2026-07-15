import { getInterviewAnswer } from "./_groq";

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

    const answer = await getInterviewAnswer(question);
    return new Response(JSON.stringify({ answer }), {
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
