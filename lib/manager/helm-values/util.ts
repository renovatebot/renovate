export type HelmDockerImageDependency = {
  registry?: string;
  repository: string;
  tag: string;
};

/**
 * This is a workaround helper to allow the usage of 'unknown' in
 * a type-guard function while checking that keys exist.
 *
 * @see https://github.com/microsoft/TypeScript/issues/21732
 * @see https://stackoverflow.com/a/58630274
 */
function hasKey<K extends string, T>(k: K, o: T): o is T & Record<K, unknown> {
  return typeof o === 'object' && k in o;
}

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
