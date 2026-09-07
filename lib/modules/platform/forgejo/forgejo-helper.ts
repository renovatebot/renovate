import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import type { GiteaHttpOptions } from '../../../util/http/gitea.ts';
import * as helper from '../gitea-common/helper.ts';
import type { RepoContents } from '../gitea-common/schema.ts';

export const forgejoHttp = new ForgejoHttp();

/**
 * Kept as a Forgejo-bound wrapper because the preset resolver fetches files
 * before any platform is initialized.
 */
export function getRepoContents(
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options: GiteaHttpOptions = {},
): Promise<RepoContents> {
  return helper.getRepoContents(forgejoHttp, repoPath, filePath, ref, options);
}
