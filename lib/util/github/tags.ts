import { logger } from '../../logger';
import type { GithubHttp } from '../http/github';
import { queryTags } from './graphql';

export async function findCommitOfTag(
  registryUrl: string | undefined,
  packageName: string,
  tag: string,
  http: GithubHttp
): Promise<string | null> {
  try {
    const tags = await queryTags({ packageName, registryUrl }, http);
    const tagItem = tags.find(({ version }) => version === tag);
    if (tagItem) {
      return tagItem.hash;
    }
  } catch (err) {
    logger.debug(
      { githubRepo: packageName, err },
      'Error getting tag commit from GitHub repo'
    );
  }
  return null;
}
