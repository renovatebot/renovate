import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import type { HelmRelease, RepoSource } from './types';

const chartRepo = regEx(/charts?|helm|helm-charts/i);
const githubRelease = regEx(
  /^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\//
);

function splitRepoUrl(url: string): RepoSource | null {
  const parsed = parseGitUrl(url);
  if (!chartRepo.test(parsed.name)) {
    return null;
  }

  if (parsed.filepath === 'tree') {
    return {
      sourceUrl: parsed.toString(),
      sourceDirectory: parsed.filepath,
    };
  }

  return {
    sourceUrl: parsed.toString(),
  };
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
