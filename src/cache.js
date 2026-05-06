import { Actor, log } from 'apify';
import config from './config.js';

let store = null;

async function getStore() {
    if (!store) {
        store = await Actor.openKeyValueStore(config.cache.kvStoreName);
    }
    return store;
}

/**
 * Extracts the stable appId from a Google Play URL.
 * Returns null for non-detail URLs (search, developer pages).
 *
 * @param {string} googlePlayUrl
 * @returns {string|null}
 */
export function extractAppId(googlePlayUrl) {
    try {
        return new URL(googlePlayUrl).searchParams.get('id');
    } catch {
        return null;
    }
}

/**
 * Returns a cached record if it exists and is within maxAgeHours.
 *
 * @param {string} appId
 * @returns {Promise<object|null>}
 */
export async function getCachedRecord(appId) {
    const s = await getStore();
    const record = await s.getValue(appId);
    if (!record) return null;

    const ageMs = Date.now() - new Date(record.processedAt).getTime();
    if (ageMs > config.cache.maxAgeHours * 3_600_000) {
        log.debug('Cache entry expired', { appId, ageHours: (ageMs / 3_600_000).toFixed(1) });
        return null;
    }

    return record;
}

/**
 * Persists a record to the cache, stamping processedAt to now.
 *
 * @param {string} appId
 * @param {object} record
 */
export async function setCachedRecord(appId, record) {
    const s = await getStore();
    await s.setValue(appId, { ...record, processedAt: new Date().toISOString() });
}
