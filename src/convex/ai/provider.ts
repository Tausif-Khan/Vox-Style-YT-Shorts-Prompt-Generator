/**
 * AIProvider abstraction — the app never calls a vendor SDK directly.
 * Swap implementations here without touching prompts or UI.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GenerateOptions {
  system: string;
  user: string;
  schemaJson: string; // JSON Schema description of the expected output
  maxTokens?: number;
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
      model: "gemini-2.0-flash",
      systemInstruction: opts.system,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opts.schemaJson ? JSON.parse(opts.schemaJson) : undefined,
        maxOutputTokens: opts.maxTokens ?? 8192,
        temperature: opts.temperature ?? 0.6,
      },
    });
    const result = await model.generateContent(opts.user);
    const text = result.response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("AI returned invalid JSON. Retry the stage.");
    }
  }
}

let _provider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (!_provider) _provider = new GeminiProvider();
  return _provider;
}
