export type PrecommitGitDependency = {
  repo: string;
  rev: string;
};

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

/**
 * Type guard to determine whether a given partial .pre-commit-config.yaml object potentially
 * defines a pre-commit Git hook dependency.
 *
 *   - repo: https://github.com/user/repo
 *     rev: v1.0.0
 */
export function matchesPrecommitGitHeuristic(
  data: unknown
): data is PrecommitGitDependency {
  return (
    data &&
    typeof data === 'object' &&
    hasKey('repo', data) &&
    hasKey('rev', data)
  );
}
