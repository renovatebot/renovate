export function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}
