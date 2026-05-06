import OpenAI from 'openai';
import { log } from 'apify';
import { buildScoringPrompt } from './prompt.js';
import config from './config.js';

/**
 * @typedef {Object} CriterionResult
 * @property {"Pass"|"Partial"|"Fail"} status
 * @property {number} score
 * @property {string} observation
 */

/**
 * @typedef {Object} ScoringResult
 * @property {number|null} safetyScore       - Overall score 1-10
 * @property {"green"|"yellow"|"red"|null} trafficLight
 * @property {Object.<string, CriterionResult>|null} criteria
 * @property {string[]} highPriorityFlags
 * @property {string|null} parentSummary
 * @property {string|null} scoringError      - Set if LLM call or parse failed
 */

/**
 * Calls the LLM via apify/openrouter to score an app's privacy policy.
 *
 * @param {object} app - Enriched app record (includes privacyPolicyContent)
 * @param {string} token - Apify token used for apify/openrouter authentication
 * @returns {Promise<ScoringResult>}
 */
export async function scoreApp(app, token) {
    const openai = new OpenAI({
        baseURL: config.openrouter.baseUrl,
        // apiKey must be non-empty but auth is handled via Authorization header
        apiKey: 'apify',
        defaultHeaders: {
            Authorization: `Bearer ${token}`,
        },
    });

    const emptyResult = {
        safetyScore: null,
        trafficLight: null,
        criteria: null,
        highPriorityFlags: [],
        parentSummary: null,
    };

    let content = '';
    try {
        const response = await openai.chat.completions.create({
            model: config.openrouter.model,
            messages: [{ role: 'user', content: buildScoringPrompt(app) }],
            response_format: { type: 'json_object' },
        });

        content = response.choices[0]?.message?.content ?? '';
        const parsed = JSON.parse(content);

        return {
            safetyScore: parsed.safetyScore ?? null,
            trafficLight: parsed.trafficLight ?? null,
            criteria: parsed.criteria ?? null,
            highPriorityFlags: parsed.highPriorityFlags ?? [],
            parentSummary: parsed.parentSummary ?? null,
            scoringError: null,
        };
    } catch (err) {
        log.warning('LLM scoring failed', { appId: app.appId, error: err.message, content });
        return { ...emptyResult, scoringError: err.message };
    }
}
