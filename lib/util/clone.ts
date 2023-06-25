/**
 * Creates a deep clone of an object.
 * @param input The object to clone.
 */
export function clone<T>(input: T): T {
  const res = structuredClone(input);
  Object.setPrototypeOf(res, Object.getPrototypeOf(input));
  return res;
}
