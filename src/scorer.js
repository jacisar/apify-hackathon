import OpenAI from 'openai';
import { log } from 'apify';
import { buildScoringPrompt } from './prompt.js';
import config from './config.js';

/**
 * Calls the LLM via apify/openrouter to score an app's privacy policy.
 *
 * @param {object} app - Enriched app record (includes privacyPolicyContent)
 * @param {string} token - Apify token used for apify/openrouter authentication
 * @returns {Promise<{score: number|null}>}
 */
export async function scoreApp(app, token) {
    const openai = new OpenAI({
        baseURL: config.openrouter.baseUrl,
        apiKey: token,
    });

    const prompt = buildScoringPrompt(app);

    const response = await openai.chat.completions.create({
        model: config.openrouter.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '';

    try {
        return JSON.parse(content);
    } catch {
        log.warning('Failed to parse LLM scoring response', { content, appId: app.appId });
        return { score: null };
    }
}
