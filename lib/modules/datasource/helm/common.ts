import { detectPlatform } from '../../../util/common';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';

export const chartRepo = regEx(/charts?|helm|helm-charts/i);
export const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//,
);

export function isPossibleChartRepo(url: string): boolean {
  if (detectPlatform(url) === null) {
    return false;
  }

  const parsed = parseGitUrl(url);
  return chartRepo.test(parsed.name);
}
