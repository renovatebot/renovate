import { GitTagsDatasource } from '../git-tags/index.ts';
import { getPlatformTagsDatasource } from '../git-tags/platforms.ts';
import type { GoTagDatasource } from './types.ts';

const gitTags = new GitTagsDatasource();

/**
 * Looks up how to resolve a module which {@link BaseGoDatasource.getDatasource}
 * has attributed to the `*-tags` datasource with the given id, or `null` when
 * the `go` datasource cannot resolve that datasource.
 *
 * The platform datasources are the registered instances, which `git-tags`
 * shares with every lookup; `git-tags` itself reads the hosts which are no
 * platform through `git ls-remote`, so it holds no client worth sharing.
 */
export async function getGoTagDatasource(
  datasource: string,
): Promise<GoTagDatasource | null> {
  if (datasource === GitTagsDatasource.id) {
    return gitTags;
  }

  return getPlatformTagsDatasource(datasource);
}
