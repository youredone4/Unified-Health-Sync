/**
 * KYC Assistive Face-Match Service
 * 
 * Uses OpenAI Vision (gpt-4o-mini) to compare a government ID photo with a selfie
 * and produce a match verdict for admin review. This is advisory only — it NEVER
 * auto-approves or auto-rejects an account.
 * 
 * Verdicts: HIGH_MATCH | POSSIBLE_MATCH | LOW_MATCH | INCONCLUSIVE
 * Score: 0.0–1.0 float (null when not computable)
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
  | "INCONCLUSIVE";

export interface FaceMatchResult {
  status: FaceMatchStatus;
  score: number | null;   // 0.0–1.0 confidence; null when not applicable
  reason: string;
}

function fileToBase64(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return buf.toString("base64");
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function runFaceMatch(
  idFilePath: string,
  selfieFilePath: string
): Promise<FaceMatchResult> {
  if (!fs.existsSync(selfieFilePath)) {
    return {
      status: "INCONCLUSIVE",
      score: null,
      reason: "Selfie file not found on disk. Admin must verify identity manually.",
    };
  }

  if (!fs.existsSync(idFilePath)) {
    return {
      status: "INCONCLUSIVE",
      score: null,
      reason: "ID file not found on disk. Admin must verify identity manually.",
    };
  }

  const idExt = path.extname(idFilePath).toLowerCase();
  if (idExt === ".pdf") {
    return {
      status: "INCONCLUSIVE",
      score: null,
      reason: "ID was submitted as a PDF. Face comparison requires an image file. Admin must verify identity manually.",
    };
  }

  try {
    const idBase64 = fileToBase64(idFilePath);
    const selfieBase64 = fileToBase64(selfieFilePath);
    const idMime = mimeType(idFilePath);
    const selfieMime = mimeType(selfieFilePath);

    const systemPrompt = `You are a KYC identity verification assistant for a Philippine barangay health system.
Your task is to compare two photos:
1. A government-issued ID photo (contains a small portrait photo on the ID card)
2. A webcam selfie taken by the applicant during registration

Evaluate whether the face on the ID card matches the face in the selfie.

IMPORTANT GUIDELINES:
- You are an assistive tool only. A human administrator makes the final decision.
- Be conservative: if image quality is poor, face is unclear, or the ID photo is too small, return INCONCLUSIVE.
- confidence_score is a decimal between 0 and 1 (e.g. 0.87 for 87% confidence).

Verdict meanings:
- HIGH_MATCH: Strong visual similarity between ID and selfie (confidence >= 0.75)
- POSSIBLE_MATCH: Moderate similarity, could be the same person (confidence 0.50–0.74)
- LOW_MATCH: Notable differences, unlikely the same person (confidence < 0.50)
- INCONCLUSIVE: Cannot make determination due to image quality, no face visible, or other issues

Respond in EXACTLY this JSON format (no markdown, no extra text, no comments):
{"verdict":"HIGH_MATCH","confidence_score":0.87,"reason":"The facial features including nose bridge and jaw line closely match between ID and selfie."}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please compare the face on the government ID (image 1) with the selfie (image 2) and return your assessment.",
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
    let parsed: { verdict: string; confidence_score: number; reason: string };

    try {
      const cleaned = content.replace(/```json\n?|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        status: "INCONCLUSIVE",
        score: null,
        reason: "AI returned an unparseable response. Admin must verify identity manually.",
      };
    }

    const validVerdicts: FaceMatchStatus[] = ["HIGH_MATCH", "POSSIBLE_MATCH", "LOW_MATCH", "INCONCLUSIVE"];
    const verdict = parsed.verdict as FaceMatchStatus;
    const status: FaceMatchStatus = validVerdicts.includes(verdict) ? verdict : "INCONCLUSIVE";

    let score: number | null = null;
    if (typeof parsed.confidence_score === "number") {
      score = Math.min(1, Math.max(0, parsed.confidence_score));
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason : "No reason provided.";

    return { status, score, reason };
  } catch (err: any) {
    console.error("[kyc-face-match] API error:", err?.message || err);
    return {
      status: "INCONCLUSIVE",
      score: null,
      reason: "Face comparison service encountered an error. Admin must verify identity manually.",
    };
  }
}
