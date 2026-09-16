/**
 * AIProvider abstraction — the app never calls a vendor SDK directly.
 * Swap implementations here without touching prompts or UI.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

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

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  async generate(opts: GenerateOptions): Promise<unknown> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing GOOGLE_API_KEY. Add it in Settings → Environment (or the Keys panel)."
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: opts.system,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.schemaJson ? JSON.parse(opts.schemaJson) : undefined,
        maxOutputTokens: opts.maxTokens ?? 16384,
        temperature: opts.temperature ?? 0.6,
      },
    });
    const result = await model.generateContent(opts.user);
    let text = result.response.text();
    // ponytail: strip optional markdown fences some models wrap JSON in
    text = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    try {
      return JSON.parse(text);
    } catch {
      // likely truncated by token cap — signal retryable failure
      throw new Error(
        `AI returned invalid JSON (${text.length} chars${text.length >= 7000 ? ", likely truncated" : ""}). Retry the stage.`
      );
    }
  }
}

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!_provider) _provider = new GeminiProvider();
  return _provider;
}
