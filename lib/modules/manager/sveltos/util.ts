import { regEx } from '../../../util/regex';

export function removeRepositoryName(
  repositoryName: string,
  chartName: string,
): string {
  const repoNameWithSlash = regEx(`^${repositoryName}/`, undefined, false);
  let modifiedChartName = chartName.replace(repoNameWithSlash, '');

  modifiedChartName = modifiedChartName.replace(/\/+$/, '');

  return modifiedChartName;
}
