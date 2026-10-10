import { logger } from '../../../logger/index.ts';
import { isToolName } from '../../../util/exec/types.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { ContainerbaseToolVersions } from './schema.ts';

export const defaultRegistryUrl =
  'https://containerbase.github.io/tool-versions';

export class ContainerbaseDatasource extends Datasource {
  static readonly id = 'containerbase';

  constructor() {
    super(ContainerbaseDatasource.id);
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is taken from the `releaseTimestamp` field of each version, when it is known.';

  private async fetchReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const body = await this.fetchJsonOrNull(
      joinUrlParts(registryUrl, `${packageName}.json`),
      ContainerbaseToolVersions,
    );
    if (!body) {
      return null;
    }

    const result: ReleaseResult = {
      registryUrl,
      releases: body.versions.map(
        ({ version, prerelease, releaseTimestamp }) => ({
          version,
          isStable: prerelease !== true,
          releaseTimestamp: asTimestamp(releaseTimestamp),
        }),
      ),
    };

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    // the package name is a containerbase tool, nothing else is published
    if (!isToolName(packageName)) {
      logger.debug(
        { datasource: this.id, packageName },
        'Unknown containerbase tool',
      );
      return Promise.resolve(null);
    }

    return this.cached(
      {
        key: `${registryUrl}:${packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
