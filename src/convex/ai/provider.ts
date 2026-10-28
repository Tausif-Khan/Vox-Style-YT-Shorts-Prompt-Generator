/**
 * AIProvider abstraction — the app never calls a vendor SDK directly.
 * Swap implementations here without touching prompts or UI.
 *
 * Active provider: OpenRouter (OpenAI-compatible chat completions API)
 * with the free router model. Requires OPENROUTER_API_KEY
 * (set via `bunx convex env set OPENROUTER_API_KEY ...`).
 */

export interface GenerateOptions {
  system: string;
  user: string;
  schemaJson: string; // JSON Schema description of the expected output
  maxTokens?: number; // scenes payloads are large; 16384 avoids truncation
  temperature?: number;
  /**
   * Called immediately BEFORE each network attempt (initial and retry).
   * The backend uses it to consume global quota capacity for that attempt;
   * throwing aborts the call, so a rejected attempt never reaches OpenRouter.
   */
  onBeforeAttempt?: (attempt: number) => Promise<void>;
}

/** Upstream failure marker — carries only the HTTP status, never the body. */
export class UpstreamError extends Error {
  readonly upstreamStatus: number;
  readonly timedOut: boolean;
  constructor(message: string, upstreamStatus: number, timedOut = false) {
    super(message);
    this.name = "UpstreamError";
    this.upstreamStatus = upstreamStatus;
    this.timedOut = timedOut;
  }
}

function timeoutMs(): number {
  const raw = Number.parseInt(process.env.OPENROUTER_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(raw) ? Math.min(300_000, Math.max(5_000, raw)) : 60_000;
}

/** POST /chat/completions with a hard timeout. */
async function postChat(body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // OpenRouter recommends these headers for app attribution (optional).
        "HTTP-Referer": "https://documentarystudio.app",
        "X-Title": "Format Lab",
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new UpstreamError("The AI provider timed out. Please try again.", 0, true);
    }
    throw new UpstreamError("Could not reach the AI provider. Please try again.", 0);
  } finally {
    clearTimeout(timer);
  }
}

export interface AIProvider {
  readonly name: string;
  generate(opts: GenerateOptions): Promise<unknown>;
}

const OPENROUTER_BASE =
  (process.env.OPENROUTER_BASE_URL as string | undefined) ??
  "https://openrouter.ai/api/v1";
const MODEL = (process.env.OPENROUTER_MODEL as string | undefined) ?? "openrouter/free";

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  async generate(opts: GenerateOptions): Promise<unknown> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing OPENROUTER_API_KEY. Add it via `bunx convex env set OPENROUTER_API_KEY <key>` or Settings → Environment."
      );
    }

    const buildBody = (temperature: number): string =>
      JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: opts.user },
        ],
        temperature,
        max_tokens: opts.maxTokens ?? 16384,
        response_format: { type: "json_object" },
      });

    // Free OpenAI-compatible models don't enforce response_schema server-side,
    // so the schema rides in the prompt and parsing is hardened below.
    const system = opts.schemaJson
      ? `${opts.system}\n\nOUTPUT CONTRACT — respond with a single JSON object conforming EXACTLY to this JSON Schema (no extra keys, no commentary, no markdown):\n${opts.schemaJson}`
      : opts.system;

    // Attempt 1: quota is consumed by the caller's hook, then the request goes out.
    await opts.onBeforeAttempt?.(1);
    const res = await postChat(buildBody(opts.temperature ?? 0.6));

    if (!res.ok) {
      // Do not echo upstream response bodies (may contain provider details).
      const status = res.status;
      await res.text().catch(() => ""); // drain for connection reuse
      if (status === 429) {
        throw new UpstreamError("The AI provider is rate-limited right now. Please try again shortly.", status);
      }
      throw new UpstreamError(`The AI provider returned an error (HTTP ${status}). Please try again.`, status);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    let text = json.choices?.[0]?.message?.content ?? "";
    // Reasoning models may emit <think> blocks or fenced JSON — strip both.
    text = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();
    const parsed = tryParseJson(text);
    if (parsed !== undefined) return parsed;

    // One bounded automatic retry: router models occasionally return malformed
    // or truncated JSON. The retry is a SECOND upstream request — it goes
    // through the same quota hook, which may refuse it (the refusal then
    // propagates so the caller sees the real quota message).
    await opts.onBeforeAttempt?.(2);
    const retry: Response | null = await postChat(buildBody(0.4));
    if (retry && retry.ok) {
      const rjson = (await retry.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      let rtext = rjson.choices?.[0]?.message?.content ?? "";
      rtext = rtext
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```$/m, "")
        .trim();
      const rparsed = tryParseJson(rtext);
      if (rparsed !== undefined) return rparsed;
    }
    if (retry && !retry.ok) {
      const status = retry.status;
      await retry.text().catch(() => "");
      if (status === 429) {
        throw new UpstreamError("The AI provider is rate-limited right now. Please try again shortly.", status);
      }
      throw new UpstreamError(`The AI provider returned an error (HTTP ${status}). Please try again.`, status);
    }

    throw new Error(
      `AI returned invalid JSON (${text.length} chars${text.length >= 7000 ? ", likely truncated" : ""}). Retry the stage.`
    );
  }
}

/** Parse JSON with fallbacks: direct, prose-wrapped, or truncated (repaired). */
function tryParseJson(text: string): unknown | undefined {
  const attempt = (s: string): unknown | undefined => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const direct = attempt(text);
  if (direct !== undefined) return direct;

  // prose-wrapped: take the outermost braces
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = attempt(text.slice(start, end + 1));
    if (sliced !== undefined) return sliced;
    // truncated: progressively trim trailing commas / open strings and close braces
    for (let cut = end; cut > start; cut--) {
      const tail = text[start] + text.slice(start + 1, cut);
      // strip a trailing comma or partially-written string, then close structure
      const cleaned = tail.replace(/,\s*$/, "").replace(/"[^"]*$/, "");
      // count unclosed braces/brackets and close them
      const stack: string[] = [];
      let inStr = false;
      let esc = false;
      for (const ch of cleaned) {
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
        } else if (ch === '"') inStr = true;
        else if (ch === "{" || ch === "[") stack.push(ch);
        else if (ch === "}" || ch === "]") stack.pop();
      }
      let repaired = cleaned;
      if (inStr) repaired += '"';
      while (stack.length) repaired += stack.pop() === "{" ? "}" : "]";
      const ok = attempt(repaired);
      if (ok !== undefined) return ok;
    }
  }
  return undefined;
}

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!_provider) _provider = new OpenRouterProvider();
  return _provider;
}
