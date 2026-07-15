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

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

/** Transcribes a full audio recording with Groq's hosted Whisper model.
 * Used as the authoritative transcript instead of the live Web Speech API
 * captions, since Whisper handles weak audio and long recordings without
 * the browser engine's restart gaps and silence-based word dropping. */
export async function transcribeAudio(
  audioData: ArrayBuffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  const model = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

  const form = new FormData();
  const ext = extensionForMimeType(mimeType);
  form.append("file", new Blob([audioData], { type: mimeType }), `audio.${ext}`);
  form.append("model", model);
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq transcription error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (typeof data?.text !== "string") {
    throw new Error("Groq transcription API returned an unexpected response shape");
  }
  return data.text.trim();
}
