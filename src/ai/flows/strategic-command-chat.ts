import { z } from 'zod';

const isVercel = process.env.VERCEL === 'true';

const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
    : (isVercel
        ? (process.env.VERCEL_ENV === 'production'
            ? 'https://war-matrix.vercel.app/api' // Hardcode your production domain here
            : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api` : '/api'))
        : (typeof window !== 'undefined' ? '/api' : 'http://localhost:8000/api'));
// ─── Input / Output Schemas ───────────────────────────────────────────────────

const StrategicChatInputSchema = z.object({
    directive: z.string().describe('The tactical directive or question from the operator.'),
    mode: z
        .enum(['SCENARIO_SEED', 'INTEL_UPDATE', 'FOG_OF_WAR', 'EXPLAIN_DECISION', 'GENERAL'])
        .describe('The operational mode determining the type of AI response.'),
    context: z.string().optional().describe('Current battlefield context for grounding the response.'),
});
export type StrategicChatInput = z.infer<typeof StrategicChatInputSchema>;

const StrategicChatOutputSchema = z.object({
    source: z
        .enum(['AI_STRATEGIST', 'SIMULATION_ENGINE', 'INTEL_DIVISION', 'FOG_OF_WAR_MODULE'])
        .describe('The system component generating this response.'),
    headline: z.string().describe('Short tactical headline for the message, max 12 words.'),
    body: z.string().describe('Full tactical response body. 2–5 sentences. Military tone.'),
    classification: z
        .enum(['TOP_SECRET', 'SECRET', 'CONFIDENTIAL', 'UNCLASSIFIED'])
        .describe('Classification level of the information.'),
    metrics: z
        .array(
            z.object({
                label: z.string(),
                value: z.string(),
            })
        )
        .optional()
        .describe('Optional key metrics to display alongside the response.'),
});
export type StrategicChatOutput = z.infer<typeof StrategicChatOutputSchema>;

// ─── Exported function ────────────────────────────────────────────────────────

export async function strategicCommandChat(
    input: StrategicChatInput
): Promise<StrategicChatOutput> {
    const instruction = `OUTPUT STRICTLY VALID JSON ONLY. NO EXPLANATIONS. NO MARKDOWN.
You are WARMATRIX — an advanced military AI operating within a secure command-and-control system.
Maintain military brevity. Use authoritative, technical language.

ABBREVIATION KEYS (MUST MATCH EXACTLY):
"s" = source (AI_STRATEGIST | SIMULATION_ENGINE | INTEL_DIVISION | FOG_OF_WAR_MODULE)
"h" = headline (string, max 12 words)
"b" = body (string, 2-5 sentences)
"c" = classification (TOP_SECRET | SECRET | CONFIDENTIAL | UNCLASSIFIED)
"m" = metrics (array of { "l": string, "v": string }) [Optional]

EXAMPLE JSON TO OUTPUT:
{"s":"AI_STRATEGIST","h":"...","b":"...","c":"SECRET"}

MODE: ${input.mode}
INSTRUCTIONS:
- SCENARIO_SEED: Generate scenario narrative. Source = AI_STRATEGIST.
- INTEL_UPDATE: Intelligence summary. Source = INTEL_DIVISION.
- FOG_OF_WAR: Inject uncertainty event. Source = FOG_OF_WAR_MODULE.
- EXPLAIN_DECISION: Explain decision with metrics. Source = SIMULATION_ENGINE.
- GENERAL: Tactical analysis. Source = AI_STRATEGIST.`;

    const battlefield_data = `CONTEXT: ${input.context || 'Field Operations'}
DIRECTIVE: ${input.directive}

GENERATE RAW JSON DICTIONARY:`;

    try {
        const res = await fetch(`${apiBaseUrl}/sitrep`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
            },
            body: JSON.stringify({
                instruction,
                battlefield_data,
                max_new_tokens: 400,
                use_cache: true,
                do_sample: false,
            })
        });

        if (!res.ok) {
            throw new Error(`Local backend error (${res.status})`);
        }

        const data = await res.json();
        let text = data.response?.trim() || '';
        text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();

        const match = text.match(/\{[\s\S]*\}/);
        const jsonString = match ? match[0] : text;
        const parsed = JSON.parse(jsonString);

        const mapped: StrategicChatOutput = {
            source: parsed.s || parsed.source || 'AI_STRATEGIST',
            headline: parsed.h || parsed.headline || 'COMMUNICATION RECEIVED',
            body: parsed.b || parsed.body || 'Uplink established. Awaiting tactical synchronization.',
            classification: parsed.c || parsed.classification || 'CONFIDENTIAL',
            metrics: (parsed.m || parsed.metrics || []).map((m: any) => ({
                label: m.l || m.label,
                value: m.v || m.value,
            })),
        };

        return StrategicChatOutputSchema.parse(mapped);
    } catch (e) {
        console.error('Strategic Chat Inference Error:', e);
        return {
            source: 'AI_STRATEGIST',
            headline: 'COMMUNICATIONS LINK FAILURE',
            body: 'Strategic analysis link to local LLM backend interrupted. Check system logs for connectivity status.',
            classification: 'UNCLASSIFIED',
        };
    }
}
