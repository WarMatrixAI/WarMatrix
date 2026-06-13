import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { GEMINI_API_KEY_COOKIE, GEMINI_MODEL_COOKIE } from '@/lib/gemini-auth';

const AI_SERVER_BASE = process.env.AI_SERVER_BASE_URL ?? 'http://127.0.0.1:8000';
const SIM_SERVER_BASE = process.env.SIM_SERVER_BASE_URL ?? 'http://127.0.0.1:8001';
const INFERENCE_TIMEOUT_MS = 300_000; // 5 min — CPU inference can be slow
const HEALTH_TIMEOUT_MS = 5_000;     // 5 s  — quick ping only
const SIM_TIMEOUT_MS = 120_000;
const GEMINI_KEY_REQUIRED = process.env.USE_GEMINI_KEY === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SitrepRequestBody {
    /** The operator's raw tactical directive / question */
    directive?: string;
    /** Current battlefield state (units, grid positions, weather, etc.) */
    battlefield_data?: string;
    /**
     * Optional operational mode — used to enrich the instruction sent to the
     * model so it frames its response correctly.
     */
    mode?: 'SCENARIO_SEED' | 'INTEL_UPDATE' | 'FOG_OF_WAR' | 'EXPLAIN_DECISION' | 'GENERAL';
    /** Max tokens for the model to emit (clamped to 64-1024). */
    max_new_tokens?: number;
    /** Sampling temperature (clamped to 0.0-2.0). */
    temperature?: number;
    /** Nucleus sampling top-p (clamped to 0.1-1.0). */
    top_p?: number;

    // Simulation-tick payload
    command?: unknown;
    current_state?: unknown;
    end_simulation?: boolean;
    initialize_scenario?: boolean;
    scenario?: unknown;
    response_schema?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps the UI mode into a concrete instruction passed to the wargaming model. */
function buildInstruction(directive: string, mode: SitrepRequestBody['mode']): string {
    const prefixes: Record<NonNullable<SitrepRequestBody['mode']>, string> = {
        SCENARIO_SEED:
            'Generate a full operational scenario briefing including strategic context, battlefield situation, and initial intelligence based on the following:',
        INTEL_UPDATE:
            'Provide a detailed intelligence update including enemy movements, signal intercepts, and threat assessments based on the following:',
        FOG_OF_WAR:
            'Inject a realistic fog-of-war uncertainty event (lost comms, unidentified units, weather disruption) into the following scenario:',
        EXPLAIN_DECISION:
            'Provide structured explainable reasoning for the simulation results, predicted outcomes, and risk signals based on the following:',
        GENERAL: 'Generate a tactical SITREP in response to the following commander directive:',
    };

    const prefix = prefixes[mode ?? 'GENERAL'];
    return `${prefix}\n\n${directive}`;
}

/** Safely clamps a number within a min/max range. */
function clamp(val: number | undefined, min: number, max: number, def: number): number {
    if (val === undefined || isNaN(Number(val))) return def;
    return Math.max(min, Math.min(max, Number(val)));
}

async function getGeminiApiKey(): Promise<string> {
    const cookieStore = await cookies();
    const cookieKey = cookieStore.get(GEMINI_API_KEY_COOKIE)?.value?.trim() ?? '';
    return cookieKey || (process.env.GEMINI_API_KEY?.trim() ?? '');
}

async function requireGeminiApiKey() {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const isVercel = host.split(':')[0].endsWith('.vercel.app');
    const isKeyRequired = GEMINI_KEY_REQUIRED || isVercel;

    if (!isKeyRequired) {
        return null;
    }

    const geminiApiKey = await getGeminiApiKey();
    if (geminiApiKey) {
        return null;
    }

    return NextResponse.json(
        {
            error: 'gemini_key_required',
            details: 'A Gemini API key must be entered at /login before using this deployment.',
        },
        { status: 401 }
    );
}

// ─── GET  /api/sitrep  (health check proxy) ───────────────────────────────────

export async function GET() {
    const keyError = await requireGeminiApiKey();
    if (keyError) {
        return keyError;
    }

    const geminiApiKey = await getGeminiApiKey();
    const cookieStore = await cookies();
    if (geminiApiKey) {
        const selectedModel = cookieStore.get(GEMINI_MODEL_COOKIE)?.value?.trim();
        const modelName = selectedModel || (process.env.GEMINI_MODEL ?? 'gemini-3.5-flash');
        return NextResponse.json({
            ok: true,
            service: 'gemini-api',
            model_loaded: true,
            device: 'cloud',
            model: modelName,
        });
    }

    try {
        const res = await fetch(`${AI_SERVER_BASE}/health`, {
            signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        const data = await res.json();
        let model = 'Local Model';
        if (data.use_lm_studio) {
            model = 'LM Studio';
        } else if (data.model_path) {
            const parts = data.model_path.split(/[\\/]/);
            model = parts[parts.length - 1] || 'Local Model';
        }
        return NextResponse.json({
            ...data,
            model,
        }, { status: res.status });
    } catch {
        return NextResponse.json(
            { ok: false, error: 'ai_server_offline', model_loaded: false, model: 'Offline' },
            { status: 503 }
        );
    }
}

// ─── POST /api/sitrep ─────────────────────────────────────────────────────────

function isSimulationTickRequest(raw: SitrepRequestBody): boolean {
    return (
        raw.command !== undefined ||
        raw.current_state !== undefined ||
        raw.end_simulation === true
    );
}

function isScenarioInitializationRequest(raw: SitrepRequestBody): boolean {
    return raw.initialize_scenario === true || raw.scenario !== undefined;
}

export async function POST(req: Request) {
    const keyError = await requireGeminiApiKey();
    if (keyError) {
        return keyError;
    }

    const geminiApiKey = await getGeminiApiKey();

    // 1. Parse incoming body
    let raw: SitrepRequestBody;
    try {
        raw = (await req.json()) as SitrepRequestBody;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 2. Branch by payload type
    if (isScenarioInitializationRequest(raw)) {
        const payload = {
            scenario: raw.scenario,
        };

        try {
            const res = await fetch(`${SIM_SERVER_BASE}/api/initialize_scenario`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': geminiApiKey,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(SIM_TIMEOUT_MS),
            });

            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        } catch (err: unknown) {
            const isTimeout =
                (err instanceof DOMException && err.name === 'TimeoutError') ||
                (err instanceof Error && err.name === 'TimeoutError');

            if (isTimeout) {
                return NextResponse.json(
                    {
                        error: 'scenario_initialization_timeout',
                        details: `Scenario initialization timed out after ${SIM_TIMEOUT_MS / 1000}s.`,
                    },
                    { status: 504 }
                );
            }

            return NextResponse.json(
                {
                    error: 'simulation_backend_offline',
                    details: 'Could not reach the Python simulation backend. Is backend/main.py running on port 8001?',
                },
                { status: 503 }
            );
        }
    }

    if (isSimulationTickRequest(raw)) {
        const payload = {
            command: raw.command ?? raw.directive ?? 'hold position',
            current_state: raw.current_state,
            end_simulation: raw.end_simulation ?? false,
            max_new_tokens: clamp(raw.max_new_tokens, 32, Number.MAX_SAFE_INTEGER, 512),
            temperature: clamp(raw.temperature, 0.0, 2.0, 0.45),
            top_p: clamp(raw.top_p, 0.1, 1.0, 0.9),
        };

        try {
            const res = await fetch(`${SIM_SERVER_BASE}/api/simulate_tick`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-api-key': geminiApiKey,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(SIM_TIMEOUT_MS),
            });

            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        } catch (err: unknown) {
            const isTimeout =
                (err instanceof DOMException && err.name === 'TimeoutError') ||
                (err instanceof Error && err.name === 'TimeoutError');

            if (isTimeout) {
                return NextResponse.json(
                    {
                        error: 'simulation_timeout',
                        details: `Simulation backend did not respond within ${SIM_TIMEOUT_MS / 1000}s.`,
                    },
                    { status: 504 }
                );
            }

            return NextResponse.json(
                {
                    error: 'simulation_backend_offline',
                    details: 'Could not reach the Python simulation backend. Is backend/main.py running on port 8001?',
                },
                { status: 503 }
            );
        }
    }

    // 3. Validate required fields for AI-only endpoint
    const directive = (raw.directive ?? '').trim();
    const battlefield_data = (raw.battlefield_data ?? '').trim();

    if (!directive && !battlefield_data) {
        return NextResponse.json(
            { error: 'At least one of directive or battlefield_data is required.' },
            { status: 400 }
        );
    }

    // 4. Structure / enrich the payload before forwarding
    const payload = {
        instruction: buildInstruction(directive || 'Generate a tactical SITREP.', raw.mode),
        battlefield_data: battlefield_data || directive,
        max_new_tokens: clamp(raw.max_new_tokens, 32, Number.MAX_SAFE_INTEGER, 512),
        temperature: clamp(raw.temperature, 0.0, 2.0, 0.45),
        top_p: clamp(raw.top_p, 0.1, 1.0, 0.9),
    };

    // 5. Forward to Gemini API directly or the Python AI server
    if (geminiApiKey) {
        try {
            const systemInstruction = 
                "You are the WarMatrix Tactical AI Strategist. The wargame simulation has transitioned to a continuous, real-world coordinate system " +
                "with float values for coordinates and multi-layered semantic terrain (Urban cover, Plains open ground, Mountain elevation, " +
                "and rapid-transit Roads). The system operates on a time-stepped tick loop incorporating stateful units (Infantry, Armor, Recon, " +
                "Artillery, Logistics, Command) that transition through Active, Damaged, and Destroyed statuses. Weather conditions " +
                "(Fog, Storm, Sandstorm) directly reduce vision, movement, and accuracy. When providing briefings, sitreps, or explaining " +
                "decisions, always reason and speak in terms of these continuous spatial dynamics, cover values, weather impact, and " +
                "detailed stateful entity attributes.";

            const userPrompt = 
                "Below is an instruction that describes a task, paired with an input that provides further context. " +
                "Write a response that appropriately completes the request.\n" +
                "Return only the final SITREP output. Do not include reasoning, analysis notes, or <think> blocks.\n\n" +
                `### Instruction:\n${payload.instruction}\n\n` +
                `### Input:\n${payload.battlefield_data}\n\n` +
                "### Response:\n";

            const isJsonRequested = payload.instruction.toLowerCase().includes("json");

            const geminiPayload = {
                contents: [
                    {
                        parts: [
                            { text: userPrompt }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [
                        { text: systemInstruction }
                    ]
                },
                generationConfig: {
                    temperature: payload.temperature,
                    maxOutputTokens: payload.max_new_tokens,
                    topP: payload.top_p,
                    ...(isJsonRequested ? { responseMimeType: "application/json" } : {}),
                    ...(raw.response_schema ? { responseSchema: raw.response_schema } : {})
                }
            };

            const cookieStore = await cookies();
            const selectedModel = cookieStore.get(GEMINI_MODEL_COOKIE)?.value?.trim();
            const modelName = selectedModel || (process.env.GEMINI_MODEL ?? 'gemini-3.5-flash');
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(geminiPayload),
                signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
            });

            const data = await res.json();

            if (!res.ok) {
                return NextResponse.json(
                    {
                        error: 'gemini_api_error',
                        details: data?.error?.message ?? 'Direct Gemini API request failed.',
                    },
                    { status: res.status }
                );
            }

            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            
            return NextResponse.json({
                ok: true,
                response: responseText,
                ai_narrative_output: responseText,
                source: 'gemini_api'
            });
        } catch (err: unknown) {
            const isTimeout =
                (err instanceof DOMException && err.name === 'TimeoutError') ||
                (err instanceof Error && err.name === 'TimeoutError');

            if (isTimeout) {
                return NextResponse.json(
                    {
                        error: 'gemini_api_timeout',
                        details: `Gemini API did not respond within ${INFERENCE_TIMEOUT_MS / 1000}s.`,
                    },
                    { status: 504 }
                );
            }

            return NextResponse.json(
                {
                    error: 'gemini_api_failed',
                    details: err instanceof Error ? err.message : 'Unknown error during Gemini API fetch.',
                },
                { status: 500 }
            );
        }
    }

    try {
        const res = await fetch(`${AI_SERVER_BASE}/api/sitrep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-gemini-api-key': geminiApiKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: 'ai_inference_error',
                    details: data?.details ?? data?.error ?? 'Inference failed on the AI server.',
                },
                { status: res.status }
            );
        }

        // Normalize response for frontend consistency
        if (data.response && !data.ai_narrative_output) {
            data.ai_narrative_output = data.response;
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err: unknown) {
        const isTimeout =
            (err instanceof DOMException && err.name === 'TimeoutError') ||
            (err instanceof Error && err.name === 'TimeoutError');

        if (isTimeout) {
            // Server is alive but inference took too long — NOT the same as offline
            return NextResponse.json(
                {
                    error: 'ai_inference_timeout',
                    details: `AI server did not respond within ${INFERENCE_TIMEOUT_MS / 1000}s. The model may still be running.`,
                },
                { status: 504 }
            );
        }

        return NextResponse.json(
            {
                error: 'ai_server_offline',
                details: 'Could not reach the local AI server. Is backend_server.py running?',
            },
            { status: 503 }
        );
    }
}
