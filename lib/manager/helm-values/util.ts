/**
 * Determine whether a given Helm values.yaml object potentially defines a Docker
 * dependency.
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
  parentKey: str,
  value: any
): bool {
  return (
    parentKey === 'image' &&
    typeof value === 'object' &&
    value.repository &&
    value.tag
  );
}
