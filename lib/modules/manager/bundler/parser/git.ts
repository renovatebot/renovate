import is from '@sindresorhus/is';
import type { KvArgs } from './common';

export interface GitRefData {
  datasource: 'git-refs';
  packageName: string;
  sourceUrl: string;
  currentDigest?: string;
  currentValue?: string;
}

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
    result.sourceUrl = git;
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
