import mergeConfidence from './merge-confidence/index.ts';
import type { EnrichmentApi } from './types.ts';

const api = new Map<string, EnrichmentApi>();
api.set(mergeConfidence.id, mergeConfidence);
export default api;
