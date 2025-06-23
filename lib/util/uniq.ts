export function uniq<T = unknown>(
  array: T[],
  eql = (x: T, y: T): boolean => x === y,
): T[] {
  return array.filter((x, idx, arr) => arr.findIndex((y) => eql(x, y)) === idx);
}
