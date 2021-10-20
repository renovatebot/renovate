import { regEx } from '../../util/regex';
import type { HelmRelease } from './types';

const chartRepo = regEx(/charts?|helm|helm-charts/i);
const githubUrl = regEx(
  /^(?<url>https:\/\/github\.com\/[^/]+\/(?<repo>[^/]+))(?:\/|$)/
);
const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//
);

export function findSourceUrl(release: HelmRelease): string {
  // it's a github release :)
  let match = githubRelease.exec(release.urls[0]);
  if (match) {
    return match[1];
  }

  match = githubUrl.exec(release.home);
  if (chartRepo.test(match?.groups.repo)) {
    return match.groups.url;
  }

  if (!release.sources?.length) {
    return undefined;
  }

  for (const url of release.sources) {
    match = githubUrl.exec(url);
    if (chartRepo.test(match?.groups.repo)) {
      return match.groups.url;
    }
  }

  // fallback
  return release.sources[0];
}
