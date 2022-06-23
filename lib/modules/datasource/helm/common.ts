import { regEx } from '../../../util/regex';
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

  const homeMatchGroups = release.home && githubUrl.exec(release.home)?.groups;
  if (homeMatchGroups) {
    const { url: sourceUrl, path: sourceDirectory, repo } = homeMatchGroups;
    if (chartRepo.test(repo)) {
      return { sourceUrl, sourceDirectory };
    }
  }

  if (!release.sources?.length) {
    return {};
  }

  for (const url of release.sources) {
    const githubUrlMatchGroups = githubUrl.exec(url)?.groups;
    if (githubUrlMatchGroups) {
      const {
        url: sourceUrl,
        path: sourceDirectory,
        repo,
      } = githubUrlMatchGroups;
      if (chartRepo.test(repo)) {
        return { sourceUrl, sourceDirectory };
      }
    }
  }

  // fallback: if neither home nor sources are a chart repo URL, use githubUrl (if present)
  if (homeMatchGroups) {
    const { url: sourceUrl, path: sourceDirectory } = homeMatchGroups;
    if (sourceUrl && sourceDirectory) {
      return { sourceUrl, sourceDirectory };
    }
  }

  const firstSourceMatch = githubUrl.exec(release.sources[0])?.groups;
  if (firstSourceMatch) {
    const { url: sourceUrl, path: sourceDirectory } = firstSourceMatch;
    if (sourceUrl && sourceDirectory) {
      return { sourceUrl, sourceDirectory };
    }
  }

  return { sourceUrl: release.sources[0] };
}
