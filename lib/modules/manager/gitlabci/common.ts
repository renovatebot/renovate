import is from '@sindresorhus/is';
import type { GitlabInclude, GitlabIncludeLocal } from '../gitlabci/types';

export function isGitlabIncludeLocal(
  include: GitlabInclude
): include is GitlabIncludeLocal {
  return !is.undefined((include as GitlabIncludeLocal).local);
}
