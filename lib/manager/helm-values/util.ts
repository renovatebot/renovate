import yaml from 'js-yaml';
import { logger } from '../../logger';
import { getSiblingFileName, readLocalFile } from '../../util/fs';
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

/**
 * This function looks for a Chart.yaml in the same directory as @param fileName and
 * returns its raw contents.
 *
 * @param fileName
 */
export async function getSiblingChartYamlContent(
  fileName: string
): Promise<string> {
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
  fileName: string
): Promise<any> {
  try {
    const chartContents = await getSiblingChartYamlContent(fileName);
    if (!chartContents) {
      logger.debug({ fileName }, 'Failed to find helm Chart.yaml');
      return null;
    }
    // TODO: fix me
    const chart = yaml.safeLoad(chartContents, { json: true }) as any;
    if (!(chart?.apiVersion && chart.name && chart.version)) {
      logger.debug(
        { fileName },
        'Failed to find required fields in Chart.yaml'
      );
      return null;
    }
    return chart;
  } catch (err) {
    logger.debug({ fileName }, 'Failed to parse helm Chart.yaml');
    return null;
  }
}
