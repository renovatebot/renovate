import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { isContainerbase } from '../../../util/exec/containerbase.ts';
import {
  type ConstraintName,
  isConstraintName,
  isToolName,
} from '../../../util/exec/types.ts';
import { readSystemFile } from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import {
  ContainerbaseFormats,
  ContainerbaseToolVersions,
  formatPath,
  formatVersion,
} from './schema.ts';

export const defaultRegistryUrl =
  'https://containerbase.github.io/tool-versions';

/** Where the Containerbase image embeds the tool-versions data. */
export const embeddedPath = '/usr/local/containerbase/tool-versions';

/**
 * Converts the runtime constraints of a version, keyed by the parent tool (like
 * `node`), to release constraints. Unknown constraint names are dropped.
 */
function toConstraints(
  constraints: Record<string, string> | undefined,
): Partial<Record<ConstraintName, string[]>> | undefined {
  const result: Partial<Record<ConstraintName, string[]>> = {};
  for (const [name, constraint] of Object.entries(coerceObject(constraints))) {
    if (isConstraintName(name)) {
      result[name] = [constraint];
    }
  }
  return Object.keys(result).length ? result : undefined;
}

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
    return this.cached(
      { key: buildCacheKey('formats', registryUrl) },
      async () => {
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
      },
    );
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

  /**
   * Reads the tool file embedded in the Containerbase image, or `null` when
   * Renovate doesn't run on Containerbase or the file is missing or invalid.
   */
  private async readEmbedded(
    packageName: string,
  ): Promise<ContainerbaseToolVersions | null> {
    if (!isContainerbase()) {
      return null;
    }
    const file = `${embeddedPath}/${formatPath}/${packageName}.json`;
    try {
      const content = await readSystemFile(file, 'utf8');
      return Json.pipe(ContainerbaseToolVersions).parse(content);
    } catch (err) {
      logger.debug(
        { err, datasource: this.id, file },
        'Failed to read the embedded containerbase tool-versions data',
      );
      return null;
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

    let body: ContainerbaseToolVersions | null;
    try {
      body = await this.fetchJsonOrNull(
        joinUrlParts(registryUrl, formatPath, `${packageName}.json`),
        ContainerbaseToolVersions,
      );
    } catch (err) {
      const embedded = await this.readEmbedded(packageName);
      if (!embedded) {
        throw err;
      }
      logger.debug(
        { err, datasource: this.id, packageName, registryUrl },
        'Using the tool-versions data embedded in the containerbase image',
      );
      body = embedded;
    }
    if (!body) {
      return null;
    }

    const result: ReleaseResult = {
      registryUrl,
      sourceUrl: body.sourceUrl,
      homepage: body.homepage,
      releases: body.versions.map(
        ({ version, prerelease, releaseTimestamp, constraints }) => {
          const release: Release = {
            version,
            isStable: prerelease !== true,
            releaseTimestamp: asTimestamp(releaseTimestamp),
          };
          const releaseConstraints = toConstraints(constraints);
          if (releaseConstraints) {
            release.constraints = releaseConstraints;
          }
          return release;
        },
      ),
    };

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    // the package name is a containerbase tool, nothing else is published
    if (!isToolName(packageName)) {
      logger.warn(
        { datasource: this.id, packageName },
        'Unknown containerbase tool',
      );
      return Promise.reject(
        new Error(`Unknown containerbase tool: ${packageName}`),
      );
    }

    return this.cached(
      {
        key: buildCacheKey(registryUrl, packageName),
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
