import { hasKey } from '../../util/object';

export type HelmDockerImageDependency = {
  registry?: string;
  repository: string;
  tag: string;
};

const parentKeyRe = /image$/i;

/**
 * Type guard to determine whether a given partial Helm values.yaml object potentially
 * defines a Helm Docker dependency.
 *
 * There is no exact standard of how Docker dependencies are defined in Helm
 * values.yaml files (as of February 26th 2021), this function defines a
 * heuristic based on the most commonly used format in the Helm charts:
 *
 * image:
 *   repository: 'something'
 *   tag: v1.0.0
 * renovateImage:
 *   repository: 'something'
 *   tag: v1.0.0
 */
export function matchesHelmValuesDockerHeuristic(
  parentKey: string,
  data: unknown
): data is HelmDockerImageDependency {
  return (
    parentKeyRe.test(parentKey) &&
    data &&
    typeof data === 'object' &&
    hasKey('repository', data) &&
    hasKey('tag', data)
  );
}
