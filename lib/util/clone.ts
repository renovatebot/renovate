export function clone<T>(input: T): T {
  return input ? JSON.parse(JSON.stringify(input)) : input;
}
