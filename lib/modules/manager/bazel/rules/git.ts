import is from '@sindresorhus/is';
import parseGithubUrl from 'github-url-from-git';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import type { PackageDependency } from '../../types';
import type { Target } from '../types';

export function gitDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  commit: currentDigest,
  remote,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'git_repository' &&
    is.string(depName) &&
    (is.string(currentValue) || is.string(currentDigest)) &&
    is.string(remote)
  ) {
    dep = {
      datasource: GithubReleasesDatasource.id,
      depType,
      depName,
    };

    if (is.string(currentValue)) {
      dep.currentValue = currentValue;
    }

    if (is.string(currentDigest)) {
      dep.currentDigest = currentDigest;
    }

    // TODO: Check if we really need to use parse here or if it should always be a plain https url (#9605)
    const packageName = parseGithubUrl(remote)?.substring(
      'https://github.com/'.length
    );

    // istanbul ignore else
    if (packageName) {
      dep.packageName = packageName;
    } else {
      dep.skipReason = 'unsupported-remote';
    }
  }

  return dep;
}
