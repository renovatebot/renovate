import { regEx } from '../../util/regex';
import type { HelmRelease, RepoSource } from './types';

const chartRepo = regEx(/charts?|helm|helm-charts/i);
const githubUrl = regEx(
  /^(?<url>https:\/\/github\.com\/[^/]+\/(?<repo>[^/]+))(:?\/|\/tree\/[^/]+\/(?<path>.+))?$/
);
const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//
);

export function findSourceUrl(release: HelmRelease): RepoSource {
  // it's a github release :)
  const releaseMatch = githubRelease.exec(release.urls[0]);
  if (releaseMatch) {
    return { sourceUrl: releaseMatch[1] };
  }

  if (release.home) {
    const githubUrlMatch = githubUrl.exec(release.home);
    if (githubUrlMatch?.groups && chartRepo.test(githubUrlMatch?.groups.repo)) {
      return {
        sourceUrl: githubUrlMatch.groups.url,
        sourceDirectory: githubUrlMatch.groups.path,
      };
    }
  }

  if (!release.sources?.length) {
    return {};
  }

  for (const url of release.sources) {
    const githubUrlMatch = githubUrl.exec(url);
    if (githubUrlMatch?.groups && chartRepo.test(githubUrlMatch?.groups.repo)) {
      return {
        sourceUrl: githubUrlMatch.groups.url,
        sourceDirectory: githubUrlMatch.groups.path,
      };
    }
  }

  // fallback
  return { sourceUrl: release.sources[0] };
}
