import { regEx } from '../../../util/regex';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+):\s+['"]?(?<value>[^"'\s]+)['"]?\s*$/,
);
// looks for `apiVersion: *projectsveltos.io/` with optional quoting of the value
export const fileTestRegex = regEx(
  /\s*apiVersion:\s*['"]?.*\.projectsveltos\.io\/.*['"]?/g,
);

export function removeRepositoryName(
  repositoryName: string,
  chartName: string,
): string {
  const repoNameWithSlash = regEx(`^${repositoryName}/`, undefined, false);
  let modifiedChartName = chartName.replace(repoNameWithSlash, '');

  modifiedChartName = modifiedChartName.replace(/\/+$/, '');

  return modifiedChartName;
}
