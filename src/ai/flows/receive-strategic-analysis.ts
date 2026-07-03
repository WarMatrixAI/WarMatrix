'use server';
/**
 * @fileOverview This file implements a flow for generating AI-powered strategic battlefield analysis
 * using the local LLM backend.
 *
 * - receiveStrategicAnalysis - A function that triggers the strategic analysis process.
 * - ReceiveStrategicAnalysisInput - The input type for the receiveStrategicAnalysis function.
 * - ReceiveStrategicAnalysisOutput - The return type for the receiveStrategicAnalysis function.
 */

import { z } from 'zod';
import { headers, cookies } from 'next/headers';
import { GEMINI_API_KEY_COOKIE } from '@/lib/gemini-auth';

const isVercel = process.env.VERCEL === 'true';

const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
    : (isVercel
        ? (process.env.VERCEL_ENV === 'production'
            ? 'https://war-matrix.vercel.app/api' // Hardcode your production domain here
            : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api` : '/api'))
        : 'http://localhost:8000/api');

const ReceiveStrategicAnalysisInputSchema = z.object({
  battlefieldSummary: z
    .string()
    .describe(
      'A high-level summary of the current battlefield situation, including friendly and enemy dispositions, key events, and recent intelligence reports.'
    ),
  missionObjectives: z.string().optional().describe('The primary mission objectives.'),
});
export type ReceiveStrategicAnalysisInput = z.infer<
  typeof ReceiveStrategicAnalysisInputSchema
>;

const ReceiveStrategicAnalysisOutputSchema = z.object({
  strategicOverview: z
    .string()
    .describe('A high-level strategic overview of the current battlefield situation.'),
  staffAnalysis: z.object({
    maneuver: z.string().describe('Analysis of unit movements and positioning.'),
    logistics: z.string().describe('Analysis of supply lines and resource availability.'),
    intelligence: z.string().describe('Analysis of enemy intent and capabilities.'),
  }).describe('Detailed staff-level analysis of operational variables.'),
  riskAssessment: z
    .string()
    .describe('An assessment of current operational risks and threats.'),
  predictedEnemyBehavior: z
    .string()
    .describe('Predictions regarding probable enemy actions and movements.'),
  recommendedActions: z
    .array(z.string())
    .describe('A list of recommended tactical actions for the operator to consider.'),
});
export type ReceiveStrategicAnalysisOutput = z.infer<
  typeof ReceiveStrategicAnalysisOutputSchema
>;

export async function receiveStrategicAnalysis(
  input: ReceiveStrategicAnalysisInput
): Promise<ReceiveStrategicAnalysisOutput> {
  let finalApiBaseUrl = apiBaseUrl;
  if (!isVercel) {
    let hasGeminiKey = false;
    try {
      const cookieStore = await cookies();
      const cookieKey = cookieStore.get(GEMINI_API_KEY_COOKIE)?.value?.trim();
      hasGeminiKey = !!cookieKey || !!process.env.GEMINI_API_KEY?.trim();
    } catch {
      hasGeminiKey = !!process.env.GEMINI_API_KEY?.trim();
    }

    if (hasGeminiKey) {
      try {
        const headersList = await headers();
        const host = headersList.get('host');
        if (host) {
          const protocol = headersList.get('x-forwarded-proto') || 'http';
          finalApiBaseUrl = `${protocol}://${host}/api`;
        } else {
          finalApiBaseUrl = 'http://localhost:3000/api';
        }
      } catch {
        finalApiBaseUrl = 'http://localhost:3000/api';
      }
    }
  }

  const buildFallbackFromText = (rawText: string): ReceiveStrategicAnalysisOutput => {
    const clean = rawText.replace(/\s+/g, ' ').trim();
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const pickSentence = (re: RegExp, fallback: string): string => {
      const fromSentence = sentences.find((s) => re.test(s));
      if (fromSentence) return fromSentence;
      const fromLine = lines.find((l) => re.test(l));
      return fromLine || fallback;
    };

    const directiveMatch = rawText.match(/commander\s+directive\s*[:\-]\s*(.+)/i);
    const directive = directiveMatch?.[1]?.trim();

    const extractedActions = (directive || clean)
      .split(/\.|,| and /i)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
      .slice(0, 2);

    const recommendedActions = extractedActions.length >= 2
      ? extractedActions
      : [
          directive ? `Execute directive: ${directive}.` : 'Reposition friendly maneuver elements to preserve initiative.',
          'Maintain ISR focus on enemy armor and protect objective approach lanes.',
        ];

    const mapped = {
      strategicOverview:
        sentences[0] ||
        'Battlefield remains contested with active maneuver by both friendly and enemy formations.',
      staffAnalysis: {
        maneuver: pickSentence(
          /move|advance|maneuver|reposition|flank|sector|grid|perform/i,
          'Friendly forces are maneuvering to improve positional advantage near active objectives.'
        ),
        logistics: pickSentence(
          /logistics|supply|ammo|fuel|support|corridor|line/i,
          'Logistics posture remains viable but requires route security and sustained support coverage.'
        ),
        intelligence: pickSentence(
          /intel|enemy|hostile|recon|signal|intercept|threat/i,
          'Enemy intent indicates continued pressure against key lanes with opportunistic counter-maneuver.'
        ),
      },
      riskAssessment: pickSentence(
        /risk|threat|casual|loss|danger|exposed|vulnerable/i,
        'Operational risk is moderate due to contested terrain and incomplete certainty on enemy response timing.'
      ),
      predictedEnemyBehavior: pickSentence(
        /enemy|hostile|counter|reinforce|retreat|advance|attack/i,
        'Enemy likely repositions to defend objective routes while probing for a flank opportunity next turn.'
      ),
      recommendedActions,
    };

    return ReceiveStrategicAnalysisOutputSchema.parse(mapped);
  };

  const collectJsonCandidates = (raw: string): string[] => {
    const candidates: string[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let isEscape = false;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (isEscape) {
        isEscape = false;
        continue;
      }
      if (ch === '\\') {
        isEscape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        if (depth > 0) depth--;
        if (depth === 0 && start >= 0) {
          candidates.push(raw.slice(start, i + 1));
          start = -1;
        }
      }
    }

    if (candidates.length === 0) {
      const fallback = raw.match(/\{[\s\S]*\}/);
      if (fallback?.[0]) candidates.push(fallback[0]);
    }
    return candidates;
  };

  const repairJson = (inputJson: string): string => {
    let fixed = inputJson.trim();

    // Strip accidental markdown fences.
    fixed = fixed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Handle missing commas between key-value pairs and between object/array end and next key.
    fixed = fixed.replace(/"\s+("[\w_]+"\s*:)/g, '", $1');
    fixed = fixed.replace(/([}\]0-9"])(\s*)("[\w_]+"\s*:)/g, '$1, $3');

    // Handle missing commas between adjacent objects in arrays.
    fixed = fixed.replace(/}\s*{/g, '}, {');

    // Fix unquoted keys.
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    // Remove trailing commas.
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    // Balance braces/brackets if truncated.
    let openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/}/g) || []).length;
    while (openBraces > 0) {
      fixed += '}';
      openBraces--;
    }

    let openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/]/g) || []).length;
    while (openBrackets > 0) {
      fixed += ']';
      openBrackets--;
    }

    return fixed;
  };

  const tryParseCandidate = (candidate: string): any | null => {
    const attempts = [candidate, repairJson(candidate)];
    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch {
        // Keep trying other variants.
      }
    }
    return null;
  };

  const instruction = `OUTPUT STRICTLY VALID JSON ONLY. NO EXPLANATIONS. NO MARKDOWN.
Generate a compressed Staff Strategic Assessment as a JSON dictionary using EXACT abbreviations for keys to save tokens.

ABBREVIATION KEYS (MUST MATCH EXACTLY):
"so" = strategicOverview (string, 1 short sentence max)
"ra" = riskAssessment (string, 1 short sentence max)
"peb" = predictedEnemyBehavior (string, 1 short sentence max)
"sa" = staffAnalysis (object with "m", "l", "i")
  "m" = maneuver (string)
  "l" = logistics (string)
  "i" = intelligence (string)
"r" = recommendedActions (array of exactly 2 strings)

EXAMPLE JSON TO OUTPUT:
{"so":"...","sa":{"m":"...","l":"...","i":"..."},"ra":"...","peb":"...","r":["...","..."]}
`;

  const battlefield_data = `MISSION: ${input.missionObjectives || 'Classified Operations'}
SITUATION: ${input.battlefieldSummary}

GENERATE RAW JSON DICTIONARY ONLY:`;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${finalApiBaseUrl}/sitrep`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
    body: JSON.stringify({
      instruction,
      battlefield_data,
      max_new_tokens: 500,    // Increased cap for safety
      use_cache: true,
      do_sample: false,       // Greedy decoding ensures fast, structured predictability
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Local backend error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  let text = data.response?.trim() || '';

  // Clean up code block ticks if any slipped through
  text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();

  const candidates = collectJsonCandidates(text);
  if (candidates.length === 0) {
    console.warn('No JSON candidate found in model output. Falling back to text mapper.');
    return buildFallbackFromText(text);
  }

  try {
    let parsed: any = null;
    for (const candidate of candidates) {
      parsed = tryParseCandidate(candidate);
      if (parsed) break;
    }

    if (!parsed) {
      console.warn('Unable to parse JSON candidates. Falling back to text mapper.');
      return buildFallbackFromText(text);
    }

    // Map short keys to expected schema keys
    const mapped = {
      strategicOverview: parsed.so || parsed.strategicOverview || 'Strategic overview generated successfully.',
      staffAnalysis: {
        maneuver: parsed.sa?.m || parsed.staffAnalysis?.maneuver || 'Maneuver elements deployed.',
        logistics: parsed.sa?.l || parsed.staffAnalysis?.logistics || 'Supply lines stable.',
        intelligence: parsed.sa?.i || parsed.staffAnalysis?.intelligence || 'Intel tracking hostile forces.',
      },
      riskAssessment: parsed.ra || parsed.riskAssessment || 'Nominal operational risk.',
      predictedEnemyBehavior: parsed.peb || parsed.predictedEnemyBehavior || 'Enemy forces holding position.',
      recommendedActions: parsed.r || parsed.recommendedActions || ['Proceed with caution.', 'Maintain perimeter.'],
    };

    // Validate with the Zod schema
    return ReceiveStrategicAnalysisOutputSchema.parse(mapped);
  } catch (e: any) {
    console.error('Failed to parse JSON from local model:', text.slice(0, 1000), e);
    try {
      return buildFallbackFromText(text);
    } catch (fallbackErr: any) {
      throw new Error(`Data mapping error: ${fallbackErr?.message || e?.message || 'unknown parse failure'}`);
    }
  }
}

