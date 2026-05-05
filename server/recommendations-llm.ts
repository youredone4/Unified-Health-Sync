/**
 * Phase 2 LLM augmentation for the recommendation engine.
 *
 * Two responsibilities:
 *
 *   1. plainLanguageSummary(rec) — rewrites the rule's bullets in
 *      5th-grade Filipino-English so a viewer (Mayor / Health Committee)
 *      gets the gist without DOH jargon. Cached in-memory by ruleId so
 *      one rule = one LLM call regardless of how many reviewers open it.
 *
 *   2. getClusterHint({module, barangay, entityId}) — pure DB scan, no
 *      LLM. Counts recent rows in the same module + barangay that fired
 *      the same rule's predicate, and emits a cluster banner if the
 *      threshold is hit. Phase 2 design lists rabies Cat III ≥ 3 in 7
 *      days as the canonical case.
 *
 * Both functions are intentionally best-effort: any failure (no API key,
 * cache miss, DB hiccup) returns null instead of throwing so the
 * recommendation card always renders the rule-based bullets.
 */

import OpenAI from "openai";
import { db } from "./db";
import { rabiesExposures } from "@shared/schema";
import { and, eq, gte, ne } from "drizzle-orm";

// Lazy client — instantiating without an API key throws at construction
// time, so we skip it in environments that don't have one configured
// (dev sandboxes, CI). Plain-language calls return null instead.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  _openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _openai;
}

// In-process LRU-style cache. Each rule's plain-language version is
// stable across requests, so we cache forever per process. A redeploy
// resets the cache; that's acceptable.
const summaryCache = new Map<string, string>();

const PLAIN_LANGUAGE_SYSTEM = [
  "You rewrite DOH clinical-protocol checklists in plain Filipino-English",
  "for a non-clinical reader (a barangay official or family member).",
  "Rules:",
  " - Aim for 5th-grade reading level.",
  " - 2 to 4 short sentences max — no bullet list.",
  " - Keep medical proper nouns (DOH, vaccine names) in English.",
  " - Do not invent new clinical advice; only restate what the input says.",
  " - End with: 'Ask your health worker if you are unsure.'",
].join("\n");

export interface PlainLanguageInput {
  ruleId: string;
  title: string;
  bullets: string[];
}

/**
 * Returns a cached plain-language rewrite or null if the LLM call fails.
 * The caller renders the original bullets either way; this is purely
 * additive.
 */
export async function plainLanguageSummary(
  input: PlainLanguageInput,
): Promise<string | null> {
  const cached = summaryCache.get(input.ruleId);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const userPrompt = [
      `Title: ${input.title}`,
      "Steps:",
      ...input.bullets.map((b) => `- ${b}`),
    ].join("\n");

    const response = await openai.chat.completions.create({
      model: process.env.AI_INTEGRATIONS_OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: PLAIN_LANGUAGE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 220,
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    if (!text) return null;
    summaryCache.set(input.ruleId, text);
    return text;
  } catch (err) {
    console.error("[recommendations-llm] plain-language failed:", err);
    return null;
  }
}

/** Test-only — drops the in-process cache so unit tests see fresh state. */
export function _resetPlainLanguageCacheForTests() {
  summaryCache.clear();
}

// ─── Cluster hint ────────────────────────────────────────────────────

export interface ClusterHint {
  /** Number of matching rows in the window, including the current row. */
  count: number;
  windowDays: number;
  message: string;
}

/**
 * Counts category-III rabies exposures in the same barangay within the
 * last 7 days. Excludes the current entityId. Returns a hint if 2+
 * other rows match (meaning current + 2 = 3 in window).
 *
 * Phase 2 ships the rabies cluster only; other modules can be added by
 * extending this switch. Keeping the predicate hard-coded mirrors the
 * recommendations file so reviewers see one source of truth per
 * disease.
 */
export async function getClusterHint(args: {
  module: string;
  barangay: string;
  entityId: number;
  today?: Date;
}): Promise<ClusterHint | null> {
  if (args.module !== "rabies") return null;
  if (!args.barangay) return null;

  const today = args.today ?? new Date();
  const windowDays = 7;
  const since = new Date(today);
  since.setDate(since.getDate() - windowDays);
  const sinceISO = since.toISOString().slice(0, 10);

  try {
    const rows = await db
      .select({ id: rabiesExposures.id })
      .from(rabiesExposures)
      .where(
        and(
          eq(rabiesExposures.barangay, args.barangay),
          eq(rabiesExposures.category, "III"),
          gte(rabiesExposures.exposureDate, sinceISO),
          ne(rabiesExposures.id, args.entityId),
        ),
      );
    const others = rows.length;
    const total = others + 1; // include the row the user is looking at
    if (total < 3) return null;
    return {
      count: total,
      windowDays,
      message: `Possible cluster — ${total} Category III exposures in ${args.barangay} within ${windowDays} days. Consider raising an outbreak alert.`,
    };
  } catch (err) {
    console.error("[recommendations-llm] cluster-hint failed:", err);
    return null;
  }
}
