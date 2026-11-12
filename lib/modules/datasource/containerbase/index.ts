import {
  type Arch,
  isContainerbase,
  minCbByVersion,
  toolVersionsFormat,
  toolVersionsFormatPath,
  toolVersionsPath,
} from '@renovatebot/base-image';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import {
  type ConstraintName,
  isConstraintName,
  isToolName,
} from '../../../util/exec/types.ts';
import { readSystemFile } from '../../../util/fs/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { ContainerbaseFormats, ContainerbaseToolVersions } from './schema.ts';

export const defaultRegistryUrl =
  'https://containerbase.github.io/tool-versions';

/**
 * Converts the runtime constraints of a version, keyed by the parent tool (like
 * `node`), to release constraints. Unknown constraint names are dropped. The
 * containerbase version the release needs becomes a `containerbase` constraint.
 */
function toConstraints(
  constraints: Record<string, string> | undefined,
  minCb: string | undefined,
): Partial<Record<ConstraintName, string[]>> | undefined {
  const result: Partial<Record<ConstraintName, string[]>> = {};
  for (const [name, constraint] of Object.entries(coerceObject(constraints))) {
    if (isConstraintName(name)) {
      result[name] = [constraint];
    }
  }
  if (minCb) {
    // like containerbase, a `cb` which is not valid semver is never met
    result.containerbase = [semver.valid(minCb) ? `>=${minCb}` : '<0.0.0-0'];
  }
  return Object.keys(result).length ? result : undefined;
}

/** A package name split into the containerbase tool and the arch to filter by. */
interface ToolPackage {
  tool: string;
  arch: Arch | undefined;
}

/** The containerbase arch of the host, or `undefined` for other archs. */
function getSystemArch(): Arch | undefined {
  switch (process.arch) {
    case 'x64':
      return 'amd64';
    case 'arm64':
      return 'arm64';
    default:
      logger.debug(
        { arch: process.arch },
        'Unknown system architecture for containerbase, not filtering by arch',
      );
      return undefined;
  }
}

/**
 * Parses a package name like `java?architecture=arm64` or `java?system=true`,
 * where `system=true` uses the arch of the host. Without either, or with an
 * unknown arch, releases aren't filtered by arch.
 */
function parsePackageName(packageName: string): ToolPackage {
  const [tool, query = ''] = packageName.split('?', 2);
  const params = new URLSearchParams(query);
  const architecture = params.get('architecture');
  if (architecture === 'amd64' || architecture === 'arm64') {
    return { tool, arch: architecture };
  }
  if (architecture === null && params.get('system') === 'true') {
    return { tool, arch: getSystemArch() };
  }
  return { tool, arch: undefined };
}

/**
 * Checks if a lookup failed because the site can't be reached: a server error,
 * rate limiting or a connection error, but not an error response like 404 or
 * 401. An `ExternalHostError` is checked by its cause, because `abortOnError`
 * host rules wrap every error in it.
 */
function isUnreachable(err: unknown): boolean {
  const cause = err instanceof ExternalHostError ? err.err : err;
  /* v8 ignore next -- the lookup only throws http errors, anything else is a bug */
  if (!(cause instanceof HttpError)) {
    return false;
  }
  const status = cause.response?.statusCode;
  return !status || status === 429 || status >= 500;
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
   * Reads the root index of the registry, `null` when it has none, or
   * `undefined` when it can't be read. The index is optional, so errors don't
   * fail the lookup, and `undefined` isn't cached, so the next lookup retries.
   */
  private fetchFormats(
    registryUrl: string,
  ): Promise<ContainerbaseFormats | null | undefined> {
    return this.cached(
      { key: buildCacheKey('formats', registryUrl), public: true },
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
          return undefined;
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
      ({ version }) => version === toolVersionsFormat,
    );
    if (format?.status === 'deprecated') {
      logger.once.warn(
        {
          datasource: this.id,
          registryUrl,
          format: toolVersionsFormatPath,
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
    tool: string,
  ): Promise<ContainerbaseToolVersions | null> {
    if (!isContainerbase()) {
      return null;
    }
    const file = `${toolVersionsPath}/${toolVersionsFormatPath}/${tool}.json`;
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

  /**
   * Converts a tool file to the release result, or `null` without versions.
   * Versions which need a newer containerbase get a `containerbase` constraint,
   * and the upstream `latest` version becomes the `latest` tag. With an `arch`,
   * versions whose files are for other archs only are dropped.
   */
  private toReleaseResult(
    body: ContainerbaseToolVersions,
    registryUrl: string | undefined,
    arch: Arch | undefined,
  ): ReleaseResult | null {
    const minCb = minCbByVersion(body);
    const versions = arch
      ? body.versions.filter(({ archs }) => !archs || archs.includes(arch))
      : body.versions;
    const result: ReleaseResult = {
      registryUrl,
      sourceUrl: body.sourceUrl,
      homepage: body.homepage,
      releases: versions.map(
        ({ version, prerelease, releaseTimestamp, constraints }) => {
          const release: Release = {
            version,
            isStable: prerelease !== true,
            releaseTimestamp: asTimestamp(releaseTimestamp),
          };
          const releaseConstraints = toConstraints(
            constraints,
            minCb.get(version),
          );
          if (releaseConstraints) {
            release.constraints = releaseConstraints;
          }
          return release;
        },
      ),
    };
    if (body.latest) {
      result.tags = { latest: body.latest };
    }

    return result.releases.length ? result : null;
  }

  private async fetchReleases(
    { tool, arch }: ToolPackage,
    registryUrl: string | undefined,
  ): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    // the format check only warns, so it doesn't delay the tool request
    const [, body] = await Promise.all([
      this.checkFormat(registryUrl),
      this.fetchJsonOrNull(
        joinUrlParts(registryUrl, toolVersionsFormatPath, `${tool}.json`),
        ContainerbaseToolVersions,
      ),
    ]);
    return body ? this.toReleaseResult(body, registryUrl, arch) : null;
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    const toolPackage = parsePackageName(packageName);
    // the package name is a containerbase tool, nothing else is published
    if (!isToolName(toolPackage.tool)) {
      logger.warn(
        { datasource: this.id, packageName },
        'Unknown containerbase tool',
      );
      throw new Error(`Unknown containerbase tool: ${packageName}`);
    }

    try {
      // keyed by the resolved arch, `system=true` differs between hosts
      return await this.cached(
        {
          key: buildCacheKey(registryUrl, toolPackage.tool, toolPackage.arch),
          public: true,
          fallback: true,
        },
        () => this.fetchReleases(toolPackage, registryUrl),
      );
    } catch (err) {
      // only when the site can't be reached and there is no cached result,
      // other errors like a wrong token must stay visible
      if (!isUnreachable(err)) {
        throw err;
      }
      const embedded = await this.readEmbedded(toolPackage.tool);
      if (!embedded) {
        throw err;
      }
      // warn once, so an outage or a broken mirror doesn't go unnoticed
      logger.once.warn(
        { datasource: this.id, registryUrl },
        "The containerbase tool-versions site can't be reached, using the data embedded in the image",
      );
      logger.debug(
        { err, datasource: this.id, packageName, registryUrl },
        'Using the tool-versions data embedded in the containerbase image',
      );
      return this.toReleaseResult(embedded, registryUrl, toolPackage.arch);
    }
  }
}
