export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}
