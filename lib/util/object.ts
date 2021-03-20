import is from '@sindresorhus/is';

/**
 * This is a workaround helper to allow the usage of 'unknown' in
 * a type-guard function while checking that keys exist.
 *
 * @see https://github.com/microsoft/TypeScript/issues/21732
 * @see https://stackoverflow.com/a/58630274
 */
export function hasKey<K extends string, T>(
  k: K,
  o: T
): o is T & Record<K, unknown> {
  return typeof o === 'object' && k in o;
}

export function filterUndefined(input: unknown): any {
  if (is.array(input)) {
    return input.filter((x) => x !== undefined).map((x) => filterUndefined(x));
  }

  if (is.object(input)) {
    const ret: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        ret[key] = filterUndefined(value);
      }
    }
    return ret;
  }
  return input;
}
