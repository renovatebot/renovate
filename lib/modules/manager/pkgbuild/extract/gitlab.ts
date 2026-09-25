import { regEx } from '../../../../util/regex.ts';
import { GitlabTagsDatasource } from '../../../datasource/gitlab-tags/index.ts';
import type { SourceData } from '../types.ts';

const archiveRegex = regEx(
  /^\/(?<projectPath>.+)\/-\/archive\/(?<versionWithExt>[^/]+)(?:\/.*)?$/,
);

export function parseGitLabUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const match = archiveRegex.exec(parsedUrl.pathname);
  if (!match?.groups) {
    return null;
  }

  const { projectPath, versionWithExt } = match.groups;
  const version = versionWithExt.replace(
    regEx(/\.(tar\.gz|tar\.bz2|tar\.xz|zip)$/),
    '',
  );

  if (!version) {
    return null;
  }

  const segments = projectPath.split('/');
  const repo = segments[segments.length - 1];
  const owner = segments.slice(0, -1).join('/');

  return {
    url: expandedUrl,
    version,
    owner,
    repo,
    datasource: GitlabTagsDatasource.id,
    packageName: projectPath,
  };
}
