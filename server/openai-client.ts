/**
 * Single shared OpenAI client.
 *
 * The client is created lazily and only when OPENAI_API_KEY is configured.
 * Callers must handle the `null` case: AI features are optional and the
 * rest of the system has to keep working without them.
 *
 * DATA PRIVACY NOTE: anything passed to this client leaves the LGU's
 * infrastructure and is processed by OpenAI outside the Philippines.
 * Callers are responsible for sending aggregated / de-identified data
 * only — never patient names, addresses, contact numbers or identifiers.
 */
import OpenAI from "openai";
import { config } from "./config";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!config.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
    });
  }
  return client;
}

export const OPENAI_MODEL = config.OPENAI_MODEL;

/** Thrown by AI features when no API key is configured. Routes map it to 503. */
export class AiNotConfiguredError extends Error {
  status = 503;
  constructor() {
    super("AI features are not configured on this server.");
    this.name = "AiNotConfiguredError";
  }
}

export function requireOpenAI(): OpenAI {
  const c = getOpenAI();
  if (!c) throw new AiNotConfiguredError();
  return c;
}
