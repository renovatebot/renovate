import type { GiteaHttpOptions } from '../../../util/http/gitea.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import * as helper from '../gitea-common/helper.ts';
import type { RepoContents } from '../gitea-common/schema.ts';

export const giteaHttp = new GiteaHttp();

/**
 * Kept as a Gitea-bound wrapper because the preset resolver fetches files
 * before any platform is initialized.
 */
export function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options: GiteaHttpOptions = {},
): Promise<RepoContents> {
  return helper.getRepoContents(giteaHttp, repoPath, filePath, ref, options);
}
