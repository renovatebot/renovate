import { hasKey } from '../../util/object';
import { regEx } from '../../util/regex';
import { ConcourseDockerImageDependency } from './types';

const parentKeyRe = regEx(/image$/i);

/**
 * Type guard to determine whether a given partial Concourse values.yaml object potentially
 * defines a Concourse Docker dependency.
 *
 * There is no exact standard of how Docker dependencies are defined in Concourse
 * values.yaml files (as of February 26th 2021), this function defines a
 * heuristic based on the most commonly used format in the Concourse charts:
 *
 * image:
 *   repository: 'something'
 *   tag: v1.0.0
 * renovateImage:
 *   repository: 'something'
 *   tag: v1.0.0
 */
export function matchesConcoursePipelineDockerHeuristic(
  parentKey: string,
  data: unknown
): data is ConcourseDockerImageDependency {
  return (
    parentKeyRe.test(parentKey) &&
    data &&
    typeof data === 'object' &&
    hasKey('repository', data) &&
    hasKey('tag', data)
  );
}

export function matchesConcoursePipelineInlineImage(
  parentKey: string,
  data: unknown
): data is string {
  return parentKeyRe.test(parentKey) && data && typeof data === 'string';
}
