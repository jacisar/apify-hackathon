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
        // baseURL without /v1 — openai SDK appends /chat/completions directly
        baseUrl: 'https://apify--openrouter.apify.actor',
        model: 'google/gemini-flash-2.0',
    },
};
