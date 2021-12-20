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
  let match = githubRelease.exec(release.urls[0]);
  if (match) {
    return { sourceUrl: match[1] };
  }

  match = githubUrl.exec(release.home);
  if (chartRepo.test(match?.groups.repo)) {
    return { sourceUrl: match.groups.url, sourceDirectory: match.groups.path };
  }

  if (!release.sources?.length) {
    return {};
  }

  for (const url of release.sources) {
    match = githubUrl.exec(url);
    if (chartRepo.test(match?.groups.repo)) {
      return {
        sourceUrl: match.groups.url,
        sourceDirectory: match.groups.path,
      };
    }
  }

  // fallback
  return { sourceUrl: release.sources[0] };
}
