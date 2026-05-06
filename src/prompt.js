/**
 * Builds the scoring prompt sent to the LLM.
 * Replace the instructions below with real privacy scoring criteria.
 *
 * @param {object} app - App record from google-play-scraper
 * @returns {string} Prompt text
 */
export function buildScoringPrompt(app) {
    return `You are evaluating a mobile app privacy policy.

App: ${app.title}
Developer: ${app.developer}
Privacy Policy URL: ${app.privacyPolicy ?? 'not available'}

Privacy Policy text:
${app.privacyPolicyContent || '(not available)'}

TODO: Replace this placeholder with real scoring criteria.
For now, assign a random score between 0 and 100.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "score": <integer 0-100>
}`;
}
