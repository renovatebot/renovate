import is from '@sindresorhus/is';

export function clone<T>(input: T, refs = new WeakSet<any>()): T {
  if (is.array(input)) {
    refs.add(input);
    const output: unknown = new Array(input.length);
    for (let idx = 0; idx < input.length; idx += 1) {
      const elem = input[idx];

      if (refs.has(elem)) {
        return undefined;
      }

      output[idx] = clone(elem, refs);
    }
    refs.delete(input);

    return output as T;
  }

  if (is.plainObject<any>(input)) {
    refs.add(input);
    const output: unknown = {};
    for (const [key, elem] of Object.entries(input)) {
      output[key] = refs.has(elem) ? undefined : clone(elem, refs);
    }
    refs.delete(input);

    return output as T;
  }

  return input;
}
