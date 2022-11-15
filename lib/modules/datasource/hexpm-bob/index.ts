import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { PackageType, datasource, defaultRegistryUrl } from './common';

export class HexpmBobDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl ?? defaultRegistryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const packageType = this.getPackageType(packageName);

    if (!packageType) {
      return null;
    }

    logger.trace(
      { registryUrl: registryUrl ?? defaultRegistryUrl, packageName },
      `fetching hex.pm bob ${packageName} release`
    );

    const url = `${
      registryUrl ?? defaultRegistryUrl
    }/builds/${packageName}/builds.txt`;

    const result: ReleaseResult = {
      releases: [],
      ...this.getPackageDetails(packageType),
    };
    try {
      const { body } = await this.http.get(url);
      result.releases = body
        .split('\n')
        .map((line) => line.trim())
        .filter(is.nonEmptyString)
        .map((line) => {
          const [version, gitRef, buildDate] = line.split(' ');

          return {
            gitRef,
            isStable: this.isStable(version, packageType),
            releaseTimestamp: buildDate,
            version: this.cleanVersion(version, packageType),
          };
        });
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length > 0 ? result : null;
  }

  private getPackageType(packageName: string): PackageType | null {
    if (packageName === 'elixir') {
      return 'elixir';
    }
    if (packageName.startsWith('otp/')) {
      return 'erlang';
    }
    return null;
  }

  // eslint-disable-next-line consistent-return
  private cleanVersion(version: string, packageType: PackageType): string {
    switch (packageType) {
      case 'elixir':
        return version.replace(/^v/, '');
      case 'erlang':
        return version.replace(/^OTP-/, '');
    }
  }

  // eslint-disable-next-line consistent-return
  private isStable(version: string, packageType: PackageType): boolean {
    switch (packageType) {
      case 'elixir':
        return version.match(/^v\d+\.\d+\.\d+($|-otp)/) !== null;
      case 'erlang':
        return version.startsWith('OTP-');
    }
  }

  private getPackageDetails(
    packageType: PackageType
  ): Omit<ReleaseResult, 'releases'> {
    let specificDetails: Partial<ReleaseResult>;
    switch (packageType) {
      case 'elixir':
        specificDetails = {
          homepage: 'https://elixir-lang.org/',
          sourceUrl: 'https://github.com/elixir-lang/elixir.git',
        };
        break;
      case 'erlang':
        specificDetails = {
          homepage: 'https://www.erlang.org/',
          sourceUrl: 'https://github.com/erlang/otp.git',
        };
        break;
    }

    return { isPrivate: false, ...specificDetails };
  }
}
