// Minimal Gemini client over REST – no SDK needed.
const API = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY;

export const hasKey = Boolean(KEY);
export const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const EMBED_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBED_DIM = 768; // smaller vectors, same quality for ~100 products

async function call(path: string, body: unknown) {
  if (!KEY) throw new Error("GEMINI_API_KEY is missing from .env");
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json?.error?.message || res.statusText}`);
  return json;
}

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Embeds texts in batches of 100 (Gemini's per-request limit). */
export async function embed(texts: string[], taskType: TaskType): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const json = await call(`models/${EMBED_MODEL}:batchEmbedContents`, {
      requests: batch.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBED_DIM,
      })),
    });
    out.push(...json.embeddings.map((e: { values: number[] }) => e.values));
  }
  return out;
}

/** Asks Gemini for a JSON object. */
export async function generateJSON(system: string, user: string): Promise<any> {
  const json = await call(`models/${CHAT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "{}";
  return JSON.parse(text);
}
