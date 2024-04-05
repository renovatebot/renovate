import is from '@sindresorhus/is';

type Falsy = false | '' | 0 | 0n | null | undefined;

/**
 * Filter and map an array *in place* with single iteration.
 */
export function filterMap<T, U>(array: T[], fn: (item: T) => Falsy | U): U[] {
  const length = array.length;
  let newIdx = 0;
  for (let oldIdx = 0; oldIdx < length; oldIdx += 1) {
    const item = array[oldIdx];
    const res = fn(item);
    if (is.truthy(res)) {
      array[newIdx] = res as never;
      newIdx += 1;
    }
  }

  const deletedCount = length - newIdx;
  if (deletedCount) {
    array.length = length - deletedCount;
  }

  return array as never;
}
