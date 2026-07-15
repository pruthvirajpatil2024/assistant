import { CANDIDATE_CONTEXT } from "./candidateContext";

function buildSystemPrompt(): string {
  return `You are a live interview assistant helping one specific candidate answer questions in real time during an actual interview.

${CANDIDATE_CONTEXT}

Rules:
- Answer in at most 50 words.
- Bold only the important concepts using **double asterisks**.
- Give one tiny example (maximum two lines) — prefer an example drawn from the candidate's own listed projects or experience when the question relates to something they've actually built or used; otherwise use a standard concise example.
- For behavioral or HR-style questions, answer in first person as the candidate, grounded in the background above — do not invent experience they don't have.
- Do not add introductions or conclusions.
- Do not restate or summarize the candidate's background — use it only to tailor the answer's content.
- Keep the answer concise enough to fit on one mobile landscape screen.`;
}

/** Streams the interview answer as plain text chunks (already unwrapped
 * from Groq's OpenAI-style SSE envelope), so callers just forward raw
 * bytes and the client can read them with a plain ReadableStream reader —
 * no SSE parsing needed anywhere downstream. */
export async function streamInterviewAnswer(question: string): Promise<ReadableStream<Uint8Array>> {
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
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: question },
      ],
      temperature: 0.4,
      max_tokens: 300,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const upstream = res.body;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // Malformed/partial SSE line — skip it.
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
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
  const model = process.env.GROQ_STT_MODEL || "whisper-large-v3";

  const form = new FormData();
  const ext = extensionForMimeType(mimeType);
  form.append("file", new Blob([audioData], { type: mimeType }), `audio.${ext}`);
  form.append("model", model);
  form.append("response_format", "json");
  // We already assume English via the Web Speech API's lang — pinning it
  // here too skips Whisper's language-detection pass, which is both
  // faster and avoids occasional language misdetection on short clips.
  form.append("language", "en");

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
