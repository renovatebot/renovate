import { GitTagsDatasource } from '../git-tags/index.ts';
import { getPlatformTagsDatasource } from '../git-tags/platforms.ts';
import type { GoTagDatasource } from './types.ts';

const gitTags = new GitTagsDatasource();

/**
 * Looks up how to resolve a module which {@link BaseGoDatasource.getDatasource}
 * has attributed to the `*-tags` datasource with the given id, or `undefined`
 * when the `go` datasource cannot resolve that datasource.
 *
 * The platform datasources are the instances which `git-tags` shares with
 * every lookup, so that a Renovate run holds a single HTTP client per git host;
 * `git-tags` itself reads the hosts which are no platform.
 */
export function getGoTagDatasource(
  datasource: string,
): GoTagDatasource | undefined {
  if (datasource === GitTagsDatasource.id) {
    return gitTags;
  }

  return getPlatformTagsDatasource(datasource);
}
