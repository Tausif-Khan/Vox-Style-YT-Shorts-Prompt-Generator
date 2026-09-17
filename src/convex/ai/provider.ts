/**
 * AIProvider abstraction — the app never calls a vendor SDK directly.
 * Swap implementations here without touching prompts or UI.
 *
 * Active provider: TokenHarbor (OpenAI-compatible chat completions API)
 * with the free DeepSeek model. Requires TOKENHARBOR_API_KEY
 * (set via `bunx convex env set TOKENHARBOR_API_KEY ...`).
 */

export interface GenerateOptions {
  system: string;
  user: string;
  schemaJson: string; // JSON Schema description of the expected output
  maxTokens?: number; // scenes payloads are large; 16384 avoids truncation
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  generate(opts: GenerateOptions): Promise<unknown>;
}

const TOKENHARBOR_BASE =
  (process.env.TOKENHARBOR_BASE_URL as string | undefined) ??
  "https://tokenharbor.ai/v1";
const MODEL =
  (process.env.TOKENHARBOR_MODEL as string | undefined) ??
  "deepseek-v4.1-flash:free";

export class TokenHarborProvider implements AIProvider {
  readonly name = "tokenharbor";

  async generate(opts: GenerateOptions): Promise<unknown> {
    const apiKey = process.env.TOKENHARBOR_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing TOKENHARBOR_API_KEY. Add it via `bunx convex env set TOKENHARBOR_API_KEY <key>` or Settings → Environment."
      );
    }

    // Free OpenAI-compatible models don't enforce response_schema server-side,
    // so the schema rides in the prompt and parsing is hardened below.
    const system = opts.schemaJson
      ? `${opts.system}\n\nOUTPUT CONTRACT — respond with a single JSON object conforming EXACTLY to this JSON Schema (no extra keys, no commentary, no markdown):\n${opts.schemaJson}`
      : opts.system;

    const res = await fetch(`${TOKENHARBOR_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.user },
        ],
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 16384,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `TokenHarbor API error ${res.status}: ${body.slice(0, 300)}. Retry the stage.`
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    let text = json.choices?.[0]?.message?.content ?? "";
    // Reasoning models may emit <think> blocks or fenced JSON — strip both.
    text = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();
    try {
      return JSON.parse(text);
    } catch {
      // try to salvage a JSON object from surrounding prose
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          /* fall through */
        }
      }
      throw new Error(
        `AI returned invalid JSON (${text.length} chars${text.length >= 7000 ? ", likely truncated" : ""}). Retry the stage.`
      );
    }
  }
}

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!_provider) _provider = new TokenHarborProvider();
  return _provider;
}
