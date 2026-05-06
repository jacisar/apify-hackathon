import { Actor, log } from 'apify';
import { ApifyClient } from 'apify-client';
import config from './config.js';

await Actor.main(async () => {
    const input = await Actor.getInput();

    if (!input?.startUrls?.length) {
        throw new Error('Input must contain at least one startUrl');
    }

    const token = process.env.APIFY_TOKEN;
    if (!token) {
        throw new Error('Missing required environment variable: APIFY_TOKEN');
    }

    const { startUrls, includeReviews = false } = input;
    const client = new ApifyClient({ token });

    // epctex/google-play-scraper expects plain URL strings, not { url } objects
    const googlePlayUrls = startUrls.map((item) =>
        typeof item === 'string' ? item : item.url,
    );

    // --- Step 1: Scrape Google Play app metadata ---
    log.info('Starting Google Play scraper', { urlCount: googlePlayUrls.length });

    const googlePlayRun = await client.actor(config.actors.googlePlay).call({
        startUrls: googlePlayUrls,
        includeReviews,
        proxy: config.googlePlay.proxy,
    });

    log.info('Google Play scraper finished', { runId: googlePlayRun.id, status: googlePlayRun.status });

    const { items: appItems } = await client
        .dataset(googlePlayRun.defaultDatasetId)
        .listItems({ clean: true });

    log.info('Retrieved app records', { count: appItems.length });

    if (appItems.length === 0) {
        log.warning('Google Play scraper returned no results');
        return;
    }

    // --- Step 2: Collect unique Privacy Policy URLs ---
    // Note: google-play-scraper does not expose a Terms & Conditions URL,
    // so only Privacy Policy pages are crawled.
    const uniquePolicyUrls = [
        ...new Set(appItems.map((item) => item.privacyPolicy).filter(Boolean)),
    ];

    log.info('Unique privacy policy URLs found', { count: uniquePolicyUrls.length });

    // --- Step 3: Crawl Privacy Policy pages ---
    const policyContentMap = {};

    if (uniquePolicyUrls.length > 0) {
        log.info('Starting content crawler for privacy policies');

        const crawlerRun = await client.actor(config.actors.contentCrawler).call({
            startUrls: uniquePolicyUrls.map((url) => ({ url })),
            ...config.crawler,
        });

        log.info('Content crawler finished', { runId: crawlerRun.id, status: crawlerRun.status });

        const { items: crawledItems } = await client
            .dataset(crawlerRun.defaultDatasetId)
            .listItems({ clean: true });

        log.info('Crawled pages', { count: crawledItems.length });

        for (const page of crawledItems) {
            if (page.url) {
                policyContentMap[page.url] = page.markdown ?? page.text ?? '';
            }
        }
    }

    // --- Step 4: Merge crawled content into app records and push to dataset ---
    log.info('Pushing enriched records to dataset');

    for (const app of appItems) {
        await Actor.pushData({
            ...app,
            privacyPolicyContent: app.privacyPolicy
                ? (policyContentMap[app.privacyPolicy] ?? '')
                : '',
            // termsOfServiceUrl and termsOfServiceContent are not provided by the
            // google-play-scraper actor; fields are included for schema consistency.
            termsOfServiceUrl: null,
            termsOfServiceContent: '',
        });
    }

    log.info('Done', { totalRecords: appItems.length });
});
