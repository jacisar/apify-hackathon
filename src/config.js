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
        // cheerio = pure HTTP, no browser — privacy policies are static HTML
        // Uses ~100MB vs ~800MB for playwright, eliminates OOM on 1024MB runs
        crawlerType: 'cheerio',
        saveMarkdown: true,
        blockMedia: true,
        proxyConfiguration: { useApifyProxy: true },
        memoryMbytes: 512,
    },
    openrouter: {
        // apify/openrouter actor in standby mode — billed via Apify credits, no external API key needed
        baseUrl: 'https://openrouter.apify.actor/api/v1',
        // Cheap, fast model with large context — avoid openrouter/auto which may pick expensive models
        model: 'google/gemini-2.5-flash',
        // Max characters of privacy policy text sent to LLM (~12k chars ≈ 3k tokens)
        // Full policies can be 50k+ chars — truncating prevents runaway costs
        maxPolicyChars: 12_000,
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
