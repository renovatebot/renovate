import { ZodError } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import * as elmVersioning from '../../versioning/elm/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { ElmPackageReleasesSchema } from './schema.ts';

export class ElmPackageDatasource extends Datasource {
  static readonly id = 'elm-package';

  constructor() {
    super(ElmPackageDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://package.elm-lang.org'];

  override readonly defaultVersioning = elmVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the Unix timestamp in the results.';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the package name using the GitHub pattern.';

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      return null;
    }
    const baseUrl = registryUrl;
    const pkgUrl = joinUrlParts(
      baseUrl,
      'packages',
      packageName,
      'releases.json',
    );

    const { val: result, err } = await this.http
      .getJsonSafe(pkgUrl, ElmPackageReleasesSchema)
      .onError((err) => {
        logger.debug(
          {
            url: pkgUrl,
            datasource: ElmPackageDatasource.id,
            packageName,
            err,
          },
          'Error fetching elm package releases',
        );
      })
      .unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'elm-package: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    // Elm packages must be published from GitHub - the package name IS the GitHub repo path
    // (e.g., "elm/core" is published from github.com/elm/core)
    // This is enforced by the `elm publish` command
    if (packageName.includes('/')) {
      result.sourceUrl = `https://github.com/${packageName}`;
    }

    return result;
  }
}
