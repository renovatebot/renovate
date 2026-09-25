import { z } from 'zod/v4';
import type { GithubHttp } from '../http/github.ts';
import { getApiBaseUrl } from './url.ts';

const Comparison = z.object({
  status: z.enum(['ahead', 'behind', 'diverged', 'identical']),
});

/**
 * Whether the commit `head` contains the commit `base`, which is the case when
 * `base` is `head` itself or one of its ancestors.
 */
export async function containsCommit(
  http: GithubHttp,
  registryUrl: string | undefined,
  repo: string,
  base: string,
  head: string,
): Promise<boolean> {
  const url = `${getApiBaseUrl(registryUrl)}repos/${repo}/compare/${base}...${head}`;
  const { body } = await http.getJson(url, Comparison);
  return body.status === 'ahead' || body.status === 'identical';
}
