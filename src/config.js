export default {
    actors: {
        googlePlay: 'epctex/google-play-scraper',
        contentCrawler: 'apify/website-content-crawler',
    },
    googlePlay: {
        proxy: { useApifyProxy: true },
        // HTTP-only scraper, does not need much memory
        memoryMbytes: 512,
    },
    crawler: {
        // Only crawl the exact start URL, do not follow links
        maxCrawlDepth: 0,
        // Adaptive mode: fast for static pages, browser for JS-rendered
        crawlerType: 'playwright:adaptive',
        saveMarkdown: true,
        blockMedia: true,
        proxyConfiguration: { useApifyProxy: true },
        // Playwright needs more memory than a plain HTTP scraper
        memoryMbytes: 1024,
    },
    openrouter: {
        // apify/openrouter actor in standby mode — billed via Apify credits, no external API key needed
        baseUrl: 'https://openrouter.apify.actor/api/v1',
        // Use openrouter/auto to let OpenRouter pick the best available model,
        // or specify e.g. "google/gemini-2.5-flash" for a concrete model
        model: 'openrouter/auto',
    },
    cache: {
        // Named KV store shared across runs — persists between actor invocations
        kvStoreName: 'kidguard-cache',
        // Records older than this are considered stale and will be re-fetched
        maxAgeHours: 24,
    },
    dataset: {
        // Named dataset — persists across runs, visible in Apify console under Storage
        name: 'kidguard-results',
    },
};
