import cryptoRandomString from 'crypto-random-string';

let cachedTmpDirId: string = null;

export function getCachedTmpDirId(): string {
  if (!cachedTmpDirId) {
    cachedTmpDirId = cryptoRandomString({ length: 16 });
  }
  return cachedTmpDirId;
}

export function resetCachedTmpDirId(): void {
  cachedTmpDirId = null;
}
