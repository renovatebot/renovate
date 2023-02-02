const keys = new Set<string>();

export function once(key: string, fn: () => void): void {
  if (!keys.has(key)) {
    keys.add(key);
    fn();
  }
}

/**
 * For each repository, all the keys need to be reset before processing
 */
export function reset(): void {
  keys.clear();
}
