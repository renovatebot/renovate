import { detectPlatform } from '../../../util/common';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import type { HelmRelease, RepoSource } from './types';

const chartRepo = regEx(/charts?|helm|helm-charts/i);
const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//
);

function isPossibleChartRepo(url: string): boolean {
  if (detectPlatform(url) === null) {
    return false;
  }

  const parsed = parseGitUrl(url);
  return chartRepo.test(parsed.name);
}

export function findSourceUrl(release: HelmRelease): RepoSource {
  // it's a github release :)
  const releaseMatch = githubRelease.exec(release.urls[0]);
  if (releaseMatch) {
    return { sourceUrl: releaseMatch[1] };
  }

  if (release.home && isPossibleChartRepo(release.home)) {
    return { sourceUrl: release.home };
  }

  if (!release.sources?.length) {
    return {};
  }

  for (const url of release.sources) {
    if (isPossibleChartRepo(url)) {
      return { sourceUrl: url };
    }
  }

  // fallback
  return { sourceUrl: release.sources[0] };
}
