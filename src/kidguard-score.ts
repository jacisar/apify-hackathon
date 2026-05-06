// KidGuard AI — quick scoring via apify/openrouter
// Drop this file into Lovable and call scoreApp() directly.
// No dependencies — uses plain fetch.
//
// NOTE: APIFY_TOKEN is exposed to the browser. For production,
// proxy this call through a backend or Supabase Edge Function.

const OPENROUTER_URL = 'https://openrouter.apify.actor/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_POLICY_CHARS = 12_000;

export interface CriterionResult {
    status: 'Pass' | 'Partial' | 'Fail';
    score: number;
    observation: string;
}

export interface KidGuardScore {
    safetyScore: number | null;
    trafficLight: 'green' | 'yellow' | 'red' | null;
    criteria: {
        coppaConsent: CriterionResult;
        gdprArticle8: CriterionResult;
        dataRetention: CriterionResult;
        thirdPartyTracking: CriterionResult;
        dataMinimization: CriterionResult;
        contentAppropriateness: CriterionResult;
        boundaryRespect: CriterionResult;
        childFriendlyTransparency: CriterionResult;
    } | null;
    highPriorityFlags: string[];
    parentSummary: string | null;
    scoringError: string | null;
}

export interface AppInput {
    title: string;
    developer: string;
    privacyPolicy?: string | null;
    privacyPolicyContent?: string | null;
}

function buildPrompt(app: AppInput): string {
    const policyText = app.privacyPolicyContent
        ? app.privacyPolicyContent.slice(0, MAX_POLICY_CHARS)
        : null;
    const truncated = (app.privacyPolicyContent?.length ?? 0) > MAX_POLICY_CHARS;

    return `You are the Senior Privacy Auditor for KidGuard AI, specialized in children's digital safety and international data protection laws (COPPA, GDPR Article 8, and PIPEDA).

Task: Analyze the provided privacy policy text to determine its safety for users under the age of 13. Evaluate the text against the 8 core criteria below and provide a standardized risk assessment.

Evaluation Criteria:
1. COPPA Compliance: Does it require "verifiable parental consent" for users under 13?
2. GDPR Article 8 Alignment: Does it specify age thresholds (13–16) and honor the right to be free from automated profiling?
3. Data Retention: Are there clear, limited retention periods (e.g., a 30-day standard for non-essential data)?
4. Third-Party Tracking: Does the policy permit behavioral advertising, "hidden" trackers, or data sharing with brokers?
5. Data Minimization: Does the app collect only what is strictly necessary for its function, or does it encourage oversharing?
6. Content Appropriateness: Are there safeguards against exposing children to age-inappropriate materials or manipulation?
7. Boundary Respect: Does the system respect a child's developmental capacity and avoid coercive "nudge" patterns?
8. Child-Friendly Transparency: Is the policy written in language a child or a non-legal professional parent can understand?

Scoring Benchmarks:
- Green (8–10): Strict "Privacy by Design." No third-party tracking, clear deletion buttons, and verifiable parental consent flows.
- Yellow (5–7): Standard commercial policy. May have vague retention terms or use data for "internal service improvements" that could lead to profiling.
- Red (1–4): Dangerous. Explicitly shares data with third parties for advertising, lacks parental consent mechanisms, or stores child data indefinitely.

App: ${app.title}
Developer: ${app.developer}
Privacy Policy URL: ${app.privacyPolicy ?? 'not available'}

Privacy Policy Text${truncated ? ` (truncated to first ${MAX_POLICY_CHARS} characters)` : ''}:
${policyText ?? '(Privacy policy text not available — base assessment on app metadata only and note the absence.)'}

Return ONLY valid JSON with no markdown, no explanation, strictly this structure:
{
  "safetyScore": <integer 1-10>,
  "trafficLight": <"green" | "yellow" | "red">,
  "criteria": {
    "coppaConsent":              { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "gdprArticle8":              { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "dataRetention":             { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "thirdPartyTracking":        { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "dataMinimization":          { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "contentAppropriateness":    { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "boundaryRespect":           { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" },
    "childFriendlyTransparency": { "status": <"Pass" | "Partial" | "Fail">, "score": <1-10>, "observation": "<string>" }
  },
  "highPriorityFlags": ["<string>"],
  "parentSummary": "<2-3 sentence plain-English summary of risk level and whether the app is recommended for unsupervised use>"
}`;
}

export async function scoreApp(app: AppInput, apifyToken: string): Promise<KidGuardScore> {
    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: buildPrompt(app) }],
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    const parsed = JSON.parse(content);
    return {
        safetyScore: parsed.safetyScore ?? null,
        trafficLight: parsed.trafficLight ?? null,
        criteria: parsed.criteria ?? null,
        highPriorityFlags: parsed.highPriorityFlags ?? [],
        parentSummary: parsed.parentSummary ?? null,
        scoringError: null,
    };
}
