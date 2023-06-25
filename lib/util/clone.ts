/**
 * Creates a deep clone of an object.
 * @param input The object to clone.
 */
export function clone<T = unknown>(input: T): T {
  const res = structuredClone(input);
  if (typeof input === 'object' && input !== null) {
    Object.setPrototypeOf(res, Object.getPrototypeOf(input));
  }
  return res;
}
