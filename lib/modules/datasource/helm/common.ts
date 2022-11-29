import { detectPlatform } from '../../../util/common';
import { regEx } from '../../../util/regex';
import type { HelmRelease, RepoSource } from './types';

const chartRepo = regEx(/charts?|helm|helm-charts/i);
const githubUrl = regEx(
  /^(?<url>https:\/\/[^/]+\/[^/]+\/(?<repo>[^/]+))(:?\/|\/tree\/[^/]+\/(?<path>.+))?$/
);
const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//
);

function splitRepoUrl(url: string): RepoSource | null {
  const platform = detectPlatform(url);
  if (platform === 'github') {
    const githubUrlMatch = githubUrl.exec(url);
    if (githubUrlMatch?.groups && chartRepo.test(githubUrlMatch?.groups.repo)) {
      return {
        sourceUrl: githubUrlMatch.groups.url,
        sourceDirectory: githubUrlMatch.groups.path,
      };
    }
  }
  return null;
}

export function findSourceUrl(release: HelmRelease): RepoSource {
  // it's a github release :)
  const releaseMatch = githubRelease.exec(release.urls[0]);
  if (releaseMatch) {
    return { sourceUrl: releaseMatch[1] };
  }

  if (release.home) {
    const source = splitRepoUrl(release.home);
    if (source) {
      return source;
    }
  }

  if (!release.sources?.length) {
    return {};
  }

  for (const url of release.sources) {
    const source = splitRepoUrl(url);
    if (source) {
      return source;
    }
  }

  // fallback
  return { sourceUrl: release.sources[0] };
}
