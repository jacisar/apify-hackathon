export default {
    actors: {
        googlePlay: 'epctex/google-play-scraper',
        contentCrawler: 'apify/website-content-crawler',
    },
    googlePlay: {
        proxy: { useApifyProxy: true },
    },
    crawler: {
        // Only crawl the exact start URL, do not follow links
        maxCrawlDepth: 0,
        // Adaptive mode: fast for static pages, browser for JS-rendered
        crawlerType: 'playwright:adaptive',
        saveMarkdown: true,
        blockMedia: true,
        proxyConfiguration: { useApifyProxy: true },
    },
};
