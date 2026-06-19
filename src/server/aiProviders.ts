/**
 * Multi-provider AI router for workout generation.
 * All providers are server-side only — never expose API keys to client.
 *
 * Provider order: z-ai-sdk (built-in) → Groq → Gemini → OpenRouter → heuristic fallback.
 * The z-ai-web-dev-sdk is always available as the primary provider.
 */

export interface AIProvider {
  name: string;
  isAvailable: () => boolean;
  generate: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

// ─────────────────────────────────────────────────────────────
// Circuit Breaker — protects router from failing providers
// (Finding #8 in ALGORITHM_REVIEW.md)
// ─────────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  isOpen: boolean;
}

class CircuitBreaker {
  private states = new Map<string, CircuitState>();
  private readonly threshold = 3;
  private readonly cooldownMs = 60_000;

  getState(providerName: string): CircuitState {
    let s = this.states.get(providerName);
    if (!s) {
      s = { failures: 0, lastFailureAt: 0, isOpen: false };
      this.states.set(providerName, s);
    }
    return s;
  }

  /** Returns true if provider should be skipped (circuit open). */
  shouldSkip(providerName: string): boolean {
    const s = this.getState(providerName);
    if (!s.isOpen) return false;
    // Check if cooldown has elapsed → move to half-open (allow trial)
    if (Date.now() - s.lastFailureAt > this.cooldownMs) {
      s.isOpen = false; // half-open: try once
      return false;
    }
    return true;
  }

  recordSuccess(providerName: string): void {
    const s = this.getState(providerName);
    s.failures = 0;
    s.isOpen = false;
  }

  recordFailure(providerName: string): void {
    const s = this.getState(providerName);
    s.failures++;
    s.lastFailureAt = Date.now();
    if (s.failures >= this.threshold) {
      s.isOpen = true;
      console.warn(
        `[CircuitBreaker] ${providerName} opened after ${s.failures} failures`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Provider 1: z-ai-web-dev-sdk (always available, built-in)
// ─────────────────────────────────────────────────────────────

class ZAISDKProvider implements AIProvider {
  name = "z-ai-sdk";

  isAvailable(): boolean {
    return true;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const completionPromise = zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    // 15s timeout — z-ai-sdk has no built-in abort signal (finding #14)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("z-ai-sdk timeout after 15s")), 15000);
    });

    const completion = await Promise.race([
      completionPromise,
      timeoutPromise,
    ]);

    let text = completion.choices[0]?.message?.content || "";
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    if (!text) throw new Error("z-ai-sdk returned empty response");
    return text;
  }
}

// ─────────────────────────────────────────────────────────────
// Provider 2: Groq (Llama 3.3 70B) — FASTEST
// ─────────────────────────────────────────────────────────────

class GroqProvider implements AIProvider {
  name = "groq";
  private apiKey = process.env.GROQ_API_KEY;

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) throw new Error("Groq API key not configured");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned empty response");
    return content;
  }
}

// ─────────────────────────────────────────────────────────────
// Provider 3: Gemini 2.0 Flash — HIGHEST FREE LIMITS
// ─────────────────────────────────────────────────────────────

class GeminiProvider implements AIProvider {
  name = "gemini";
  private apiKey = process.env.GEMINI_API_KEY;

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) throw new Error("Gemini API key not configured");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 2500,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Gemini returned empty response");
    return content;
  }
}

// ─────────────────────────────────────────────────────────────
// Provider 4: OpenRouter (Llama 3.3 70B free) — BACKUP
// ─────────────────────────────────────────────────────────────

class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private apiKey = process.env.OPENROUTER_API_KEY;

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) throw new Error("OpenRouter API key not configured");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Pulse Fitness",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2500,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned empty response");
    return content;
  }
}

// ─────────────────────────────────────────────────────────────
// Router — tries providers in order, falls back gracefully
// ─────────────────────────────────────────────────────────────

export class AIProviderRouter {
  private providers: AIProvider[];
  private breaker = new CircuitBreaker();

  constructor() {
    this.providers = [
      new ZAISDKProvider(),
      new GroqProvider(),
      new GeminiProvider(),
      new OpenRouterProvider(),
    ];
  }

  async generate(
    systemPrompt: string,
    userPrompt: string
  ): Promise<{ text: string; provider: string }> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        console.log(`[AI Router] ${provider.name} not configured, skipping`);
        continue;
      }

      if (this.breaker.shouldSkip(provider.name)) {
        console.log(`[AI Router] ${provider.name} in cooldown, skipping`);
        continue;
      }

      try {
        const startTime = Date.now();
        const text = await provider.generate(systemPrompt, userPrompt);
        const duration = Date.now() - startTime;
        console.log(`[AI Router] ${provider.name} succeeded in ${duration}ms`);
        this.breaker.recordSuccess(provider.name);
        return { text, provider: provider.name };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AI Router] ${provider.name} failed: ${msg}`);
        this.breaker.recordFailure(provider.name);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    throw new Error(`All AI providers failed. Errors: ${errors.join(" | ")}`);
  }

  getAvailableProviders(): string[] {
    return this.providers.filter((p) => p.isAvailable()).map((p) => p.name);
  }

  /** Health snapshot of every provider for observability. */
  getProviderHealth(): Record<
    string,
    { failures: number; isOpen: boolean }
  > {
    const result: Record<string, { failures: number; isOpen: boolean }> = {};
    for (const provider of this.providers) {
      const state = this.breaker.getState(provider.name);
      // Re-evaluate half-open transition so callers see the live state
      const isOpen = this.breaker.shouldSkip(provider.name);
      result[provider.name] = {
        failures: state.failures,
        isOpen,
      };
    }
    return result;
  }
}

export const aiRouter = new AIProviderRouter();
