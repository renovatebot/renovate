/**
 * Determine whether a given partial Helm values.yaml object potentially defines
 * a Docker dependency.
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
  data: any
): boolean {
  return (
    parentKey === 'image' &&
    data &&
    typeof data === 'object' &&
    data.repository &&
    data.tag
  );
}
