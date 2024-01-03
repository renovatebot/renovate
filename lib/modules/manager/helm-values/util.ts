import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { hasKey } from '../../../util/object';
import { regEx } from '../../../util/regex';
import { type ChartDefinition, ChartDefinitionYaml } from './schema';
import type { HelmDockerImageDependency } from './types';

const parentKeyRe = regEx(/image$/i);

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
 * image:
 *   repository: 'something'
 *   version: v1.0.0
 * renovateImage:
 *   repository: 'something'
 *   tag: v1.0.0
 */
export function matchesHelmValuesDockerHeuristic(
  parentKey: string,
  data: unknown,
): data is HelmDockerImageDependency {
  return !!(
    parentKeyRe.test(parentKey) &&
    data &&
    typeof data === 'object' &&
    hasKey('repository', data) &&
    (hasKey('tag', data) || hasKey('version', data))
  );
}

export function matchesHelmValuesInlineImage(
  parentKey: string,
  data: unknown,
): data is string {
  return !!(parentKeyRe.test(parentKey) && data && typeof data === 'string');
}

/**
 * This function looks for a Chart.yaml in the same directory as @param fileName and
 * returns its raw contents.
 *
 * @param fileName
 */
export async function getSiblingChartYamlContent(
  fileName: string,
): Promise<string | null> {
  try {
    const chartFileName = getSiblingFileName(fileName, 'Chart.yaml');
    return await readLocalFile(chartFileName, 'utf8');
  } catch (err) {
    logger.debug({ fileName }, 'Failed to read helm Chart.yaml');
    return null;
  }
}

/**
 * This function looks for a Chart.yaml in the same directory as @param fileName and
 * if it looks like a valid Helm Chart.yaml, it is parsed and returned as an object.
 *
 * @param fileName
 */
export async function getParsedSiblingChartYaml(
  fileName: string,
): Promise<ChartDefinition | null> {
  try {
    const chartContents = await getSiblingChartYamlContent(fileName);
    if (!chartContents) {
      logger.debug({ fileName }, 'Failed to find helm Chart.yaml');
      return null;
    }
    return ChartDefinitionYaml.parse(chartContents);
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
    return null;
  }
}
