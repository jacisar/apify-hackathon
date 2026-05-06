import { Actor, log } from 'apify';
import { ApifyClient } from 'apify-client';
import config from './config.js';
import { scoreApp } from './scorer.js';
import { extractAppId, getCachedRecord, setCachedRecord } from './cache.js';

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

    const dataset = await Actor.openDataset(config.dataset.name, { forceCloud: true });
    log.info('Using named dataset', { name: config.dataset.name, id: dataset.id });

    // epctex/google-play-scraper expects plain URL strings, not { url } objects
    const googlePlayUrls = startUrls.map((item) =>
        typeof item === 'string' ? item : item.url,
    );

    // -------------------------------------------------------------------------
    // Step 0: Load cache — keyed by appId extracted from the Google Play URL
    // -------------------------------------------------------------------------
    log.info('Checking cache', { urlCount: googlePlayUrls.length });

    const cacheMap = {}; // appId -> cached record
    for (const url of googlePlayUrls) {
        const appId = extractAppId(url);
        if (appId) {
            const cached = await getCachedRecord(appId);
            if (cached) {
                cacheMap[appId] = cached;
                log.info('Cache hit', { appId, processedAt: cached.processedAt });
            }
        }
    }

    // -------------------------------------------------------------------------
    // Step 1: Scrape Google Play — only for URLs whose appId is not in cache
    // -------------------------------------------------------------------------
    const urlsNeedingMetadata = googlePlayUrls.filter((url) => {
        const appId = extractAppId(url);
        return !appId || !cacheMap[appId];
    });

    const freshAppItems = [];

    if (urlsNeedingMetadata.length > 0) {
        log.info('Running Google Play scraper', { urlCount: urlsNeedingMetadata.length });

        const googlePlayRun = await client.actor(config.actors.googlePlay).call(
            { startUrls: urlsNeedingMetadata, includeReviews, proxy: config.googlePlay.proxy },
            { memory: config.googlePlay.memoryMbytes },
        );

        log.info('Google Play scraper finished', { runId: googlePlayRun.id, status: googlePlayRun.status });

        const { items } = await client
            .dataset(googlePlayRun.defaultDatasetId)
            .listItems({ clean: true });

        freshAppItems.push(...items);
        log.info('Retrieved fresh app records', { count: items.length });
    } else {
        log.info('All metadata cached — skipping Google Play scraper');
    }

    // Merge fresh results with metadata restored from cache
    const cachedAppItems = Object.values(cacheMap).map((r) => r.appMetadata ?? r);
    const allAppItems = [...freshAppItems, ...cachedAppItems];

    if (allAppItems.length === 0) {
        log.warning('No app records to process');
        return;
    }

    // -------------------------------------------------------------------------
    // Step 2: Crawl Privacy Policy pages — only for apps missing PP content
    // -------------------------------------------------------------------------

    // Pre-fill policy content map from cache
    const policyContentMap = {};
    for (const app of allAppItems) {
        const cached = cacheMap[app.appId];
        if (cached?.privacyPolicyContent && app.privacyPolicy) {
            policyContentMap[app.privacyPolicy] = cached.privacyPolicyContent;
        }
    }

    const urlsNeedingCrawling = [
        ...new Set(
            allAppItems
                .filter((app) => app.privacyPolicy && !policyContentMap[app.privacyPolicy])
                .map((app) => app.privacyPolicy),
        ),
    ];

    if (urlsNeedingCrawling.length > 0) {
        log.info('Running content crawler', { urlCount: urlsNeedingCrawling.length });

        const { memoryMbytes, ...crawlerInput } = config.crawler;
        const crawlerRun = await client.actor(config.actors.contentCrawler).call(
            { startUrls: urlsNeedingCrawling.map((url) => ({ url })), ...crawlerInput },
            { memory: memoryMbytes },
        );

        log.info('Content crawler finished', { runId: crawlerRun.id, status: crawlerRun.status });

        const { items: crawledItems } = await client
            .dataset(crawlerRun.defaultDatasetId)
            .listItems({ clean: true });

        for (const page of crawledItems) {
            if (page.url) {
                policyContentMap[page.url] = page.markdown ?? page.text ?? '';
            }
        }

        log.info('Crawled pages', { count: crawledItems.length });
    } else {
        log.info('All privacy policy content cached — skipping content crawler');
    }

    // -------------------------------------------------------------------------
    // Step 3: Build enriched records
    // -------------------------------------------------------------------------
    const enrichedRecords = allAppItems.map((app) => ({
        ...app,
        privacyPolicyContent: app.privacyPolicy
            ? (policyContentMap[app.privacyPolicy] ?? '')
            : '',
        // google-play-scraper does not expose a Terms & Conditions URL
        termsOfServiceUrl: null,
        termsOfServiceContent: '',
    }));

    // -------------------------------------------------------------------------
    // Step 4: Score apps — use cache when a non-null safetyScore is present;
    // re-score if the previous attempt failed (scoringError set, score null)
    // -------------------------------------------------------------------------
    log.info('Scoring apps', { count: enrichedRecords.length });

    for (const record of enrichedRecords) {
        const cached = cacheMap[record.appId];
        const hasCachedScore = cached?.safetyScore != null;

        let scoring;
        if (hasCachedScore) {
            log.info('Using cached score', { appId: record.appId, score: cached.safetyScore });
            scoring = {
                safetyScore: cached.safetyScore,
                trafficLight: cached.trafficLight,
                criteria: cached.criteria,
                highPriorityFlags: cached.highPriorityFlags ?? [],
                parentSummary: cached.parentSummary,
                scoringError: null,
            };
        } else {
            try {
                scoring = await scoreApp(record, token);
                log.info('Scored app', { appId: record.appId, score: scoring.safetyScore });
            } catch (err) {
                log.error('Unexpected scoring error — storing record without score', {
                    appId: record.appId,
                    error: err.message,
                });
                scoring = {
                    safetyScore: null,
                    trafficLight: null,
                    criteria: null,
                    highPriorityFlags: [],
                    parentSummary: null,
                    scoringError: err.message,
                };
            }
        }

        const fullRecord = { ...record, ...scoring, processedAt: new Date().toISOString() };

        await setCachedRecord(record.appId, { appMetadata: record, ...fullRecord });
        await dataset.pushData(fullRecord);
    }

    log.info('Done', { totalRecords: enrichedRecords.length });
});
