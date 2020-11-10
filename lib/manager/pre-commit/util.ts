import { hasKey } from '../../util/object';

export type PrecommitGitDependency = {
  repo: string;
  rev: string;
};

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
