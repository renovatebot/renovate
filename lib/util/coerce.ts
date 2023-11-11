export function coerceToNull<T>(input: T | null | undefined): T | null {
  return input ?? null;
}

export function coerceToUndefined<T>(
  input: T | null | undefined,
): T | undefined {
  return input ?? undefined;
}
