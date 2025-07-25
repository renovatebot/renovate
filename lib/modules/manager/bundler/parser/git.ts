import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type { KvArgs } from './common';

type GitRefData = Pick<
  PackageDependency,
  'datasource' | 'packageName' | 'sourceUrl' | 'currentDigest' | 'currentValue'
>;

export function extractGitRefData(kvArgs: KvArgs): GitRefData | null {
  const { git, github, ref, tag, branch } = kvArgs;

  if (!is.string(git) && !is.string(github)) {
    return null;
  }

  const result: GitRefData = {
    datasource: 'git-refs',
    packageName: '',
    sourceUrl: '',
  };

  if (is.string(git)) {
    result.packageName = git;
    result.sourceUrl = git.replace(regEx(/\.git$/), '');
  } else if (is.string(github)) {
    const fullUrl = `https://github.com/${github}`;
    result.packageName = fullUrl;
    result.sourceUrl = fullUrl;
  }

  if (is.string(ref)) {
    result.currentDigest = ref;
  } else if (is.string(tag)) {
    result.currentValue = tag;
  } else if (is.string(branch)) {
    result.currentValue = branch;
  }

  return result;
}
