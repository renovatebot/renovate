/**
 * Detects the platform error which is thrown when a PR for the source branch
 * already exists, but Renovate was unable to find it - usually because it was
 * created by a different user.
 *
 * The error object is a `got` `RequestError`, so `err.response` is the shape
 * every platform has in common. `err.statusCode` and `err.body` are only
 * available through the legacy getters in `util/http/legacy.ts`.
 */
export function isPrAlreadyExistsError(err: any): boolean {
  if (err.response?.statusCode !== 422) {
    return false;
  }
  const errors: { message?: string }[] | undefined = err.response?.body?.errors;
  return !!errors?.some((error) =>
    error.message?.startsWith('A pull request already exists'),
  );
}
