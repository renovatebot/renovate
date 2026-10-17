import { logger } from '../../../logger/index.ts';
import { isToolName } from '../../../util/exec/types.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import {
  ContainerbaseFormats,
  ContainerbaseToolVersions,
  formatPath,
  formatVersion,
} from './schema.ts';

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
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is taken from the `sourceUrl` field of the tool file, when it is known.';

  /**
   * Reads the root index of the registry, or `null` when it can't be read.
   * The index is optional, so errors don't fail the lookup.
   */
  private fetchFormats(
    registryUrl: string,
  ): Promise<ContainerbaseFormats | null> {
    return this.cached({ key: `formats:${registryUrl}` }, async () => {
      try {
        return await this.fetchJsonOrNull(
          joinUrlParts(registryUrl, 'index.json'),
          ContainerbaseFormats,
        );
      } catch (err) {
        logger.debug(
          { err, datasource: this.id, registryUrl },
          'Failed to read the containerbase root index',
        );
        return null;
      }
    });
  }

  /**
   * Warns once when the root index marks the format this datasource reads as
   * deprecated.
   */
  private async checkFormat(registryUrl: string): Promise<void> {
    const formats = await this.fetchFormats(registryUrl);
    const format = formats?.formats.find(
      ({ version }) => version === formatVersion,
    );
    if (format?.status === 'deprecated') {
      logger.once.warn(
        {
          datasource: this.id,
          registryUrl,
          format: formatPath,
          removalDate: format.removalDate,
        },
        'The containerbase tool-versions format is deprecated, update Renovate',
      );
    }
  }

  private async fetchReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    await this.checkFormat(registryUrl);

    const body = await this.fetchJsonOrNull(
      joinUrlParts(registryUrl, formatPath, `${packageName}.json`),
      ContainerbaseToolVersions,
    );
    if (!body) {
      return null;
    }

    const result: ReleaseResult = {
      registryUrl,
      sourceUrl: body.sourceUrl,
      homepage: body.homepage,
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
