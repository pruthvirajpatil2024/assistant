const SYSTEM_PROMPT = `You are an interview assistant.

Rules:
- Answer in at most 50 words.
- Bold only the important concepts using **double asterisks**.
- Give one tiny example (maximum two lines).
- Do not add introductions or conclusions.
- Keep the answer concise enough to fit on one mobile landscape screen.`;

export async function getInterviewAnswer(question: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      temperature: 0.4,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string") {
    throw new Error("Groq API returned an unexpected response shape");
  }
  return answer.trim();
}
