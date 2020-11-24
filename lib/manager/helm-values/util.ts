import { hasKey } from '../../util/object';

export type HelmDockerImageDependency = {
  registry?: string;
  repository: string;
  tag: string;
};

/**
 * Type guard to determine whether a given partial Helm values.yaml object potentially
 * defines a Helm Docker dependency.
 *
 * There is no exact standard of how Docker dependencies are defined in Helm
 * values.yaml files (as of January 1st 2020), this function defines a
 * heuristic based on the most commonly used format in the stable Helm charts:
 *
 * image:
 *   repository: 'something'
 *   tag: v1.0.0
 */
export function matchesHelmValuesDockerHeuristic(
  parentKey: string,
  data: unknown
): data is HelmDockerImageDependency {
  return (
    parentKey === 'image' &&
    data &&
    typeof data === 'object' &&
    hasKey('repository', data) &&
    hasKey('tag', data)
  );
}
