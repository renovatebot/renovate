import crypto from 'crypto';
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 60,
  useClones: false,
  maxKeys: 10000,
});

function getKey(token: string, url: string): string {
  return crypto
    .createHash('sha1')
    .update(token + url)
    .digest('base64');
}

export function get(token: string, url: string): string | null {
  return cache.get(getKey(token, url)) || null;
}

export function set(token: string, url: string, confidence: string): void {
  cache.set(getKey(token, url), confidence);
}
