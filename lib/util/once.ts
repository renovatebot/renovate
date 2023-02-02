const cache = new Set<string>();

export function once(key: string, fn: () => void): void {
  if (!cache.has(key)) {
    cache.add(key);
    fn();
  }
}

/**
 * For each repository, all the keys need to be reset before processing
 */
export function reset(): void {
  cache.clear();
}
