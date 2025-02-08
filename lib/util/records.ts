export function filterEntries<V>(
  input: Record<string, V>,
  filterFunc: (entry: [string, V]) => boolean,
): Record<string, V> {
  const result: Record<string, V> = {};

  for (const entry of Object.entries(input)) {
    if (filterFunc(entry)) {
      const [key, value] = entry;
      result[key] = value;
    }
  }

  return result;
}
