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

  let homeMatch;
  if (release.home) {
    homeMatch = githubUrl.exec(release.home);
    if (homeMatch?.groups && chartRepo.test(homeMatch?.groups.repo)) {
      return {
        sourceUrl: homeMatch.groups.url,
        sourceDirectory: homeMatch.groups.path,
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
  const firstSourceMatch = githubUrl.exec(release.sources[0]);
  if (homeMatch?.groups.url && homeMatch?.groups.path) {
    return {
      sourceUrl: homeMatch.groups.url,
      sourceDirectory: homeMatch.groups.path,
    };
  } else if (firstSourceMatch?.groups.url && firstSourceMatch?.groups.path) {
    return {
      sourceUrl: firstSourceMatch.groups.url,
      sourceDirectory: firstSourceMatch.groups.path,
    };
  } else {
    return { sourceUrl: release.sources[0] };
  }
}
