/**
 * KYC Assistive Face-Match Service
 * 
 * Uses OpenAI Vision (gpt-4o-mini) to compare a government ID photo with a selfie
 * and produce a match verdict for admin review. This is advisory only — it NEVER
 * auto-approves or auto-rejects an account.
 * 
 * Verdicts: HIGH_MATCH | POSSIBLE_MATCH | LOW_MATCH | INCONCLUSIVE | NO_SELFIE
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type FaceMatchStatus =
  | "HIGH_MATCH"
  | "POSSIBLE_MATCH"
  | "LOW_MATCH"
  | "INCONCLUSIVE"
  | "NO_SELFIE"
  | "PENDING";

export interface FaceMatchResult {
  status: FaceMatchStatus;
  score: string;
  reason: string;
}

function fileToBase64(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return buf.toString("base64");
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "image/jpeg"; // PDFs unsupported in vision; treat as jpeg fallback
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function runFaceMatch(
  idFilePath: string,
  selfieFilePath: string | null
): Promise<FaceMatchResult> {
  if (!selfieFilePath || !fs.existsSync(selfieFilePath)) {
    return { status: "NO_SELFIE", score: "N/A", reason: "No selfie was submitted." };
  }

  if (!fs.existsSync(idFilePath)) {
    return { status: "INCONCLUSIVE", score: "N/A", reason: "ID file not found on disk." };
  }

  const idExt = path.extname(idFilePath).toLowerCase();
  if (idExt === ".pdf") {
    return {
      status: "INCONCLUSIVE",
      score: "N/A",
      reason: "ID submitted as PDF — face comparison requires an image. Admin must verify manually.",
    };
  }

  try {
    const idBase64 = fileToBase64(idFilePath);
    const selfieBase64 = fileToBase64(selfieFilePath);
    const idMime = mimeType(idFilePath);
    const selfieMime = mimeType(selfieFilePath);

    const systemPrompt = `You are a KYC identity verification assistant for a Philippine barangay health system.
Your task is to compare two photos:
1. A government-issued ID photo (may show a small face in the ID card)
2. A selfie photo taken by the registrant

Evaluate whether the face on the ID matches the face in the selfie.

IMPORTANT:
- You are an assistive tool only. A human administrator will make the final decision.
- Never make definitive identity claims. Give a probability-based assessment.
- Be conservative: if image quality is poor or face is unclear, say INCONCLUSIVE.

Respond in exactly this JSON format (no markdown, no extra text):
{
  "verdict": "HIGH_MATCH" | "POSSIBLE_MATCH" | "LOW_MATCH" | "INCONCLUSIVE",
  "confidence_pct": <integer 0-100>,
  "reason": "<1-2 sentence explanation of your assessment>"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please compare these two images and provide your face-match assessment.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${idMime};base64,${idBase64}`, detail: "low" },
            },
            {
              type: "image_url",
              image_url: { url: `data:${selfieMime};base64,${selfieBase64}`, detail: "low" },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    let parsed: { verdict: string; confidence_pct: number; reason: string };

    try {
      const cleaned = content.replace(/```json\n?|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        status: "INCONCLUSIVE",
        score: "N/A",
        reason: `AI returned non-JSON response: ${content.slice(0, 120)}`,
      };
    }

    const verdict = parsed.verdict as FaceMatchStatus;
    const validVerdicts: FaceMatchStatus[] = ["HIGH_MATCH", "POSSIBLE_MATCH", "LOW_MATCH", "INCONCLUSIVE"];
    const status = validVerdicts.includes(verdict) ? verdict : "INCONCLUSIVE";

    const confidence = typeof parsed.confidence_pct === "number" ? parsed.confidence_pct : 0;
    const score = `${confidence}%`;
    const reason = parsed.reason || "No reason provided.";

    return { status, score, reason };
  } catch (err: any) {
    console.error("[kyc-face-match] Error:", err?.message || err);
    return {
      status: "INCONCLUSIVE",
      score: "N/A",
      reason: "Face comparison service unavailable. Admin should verify manually.",
    };
  }
}
