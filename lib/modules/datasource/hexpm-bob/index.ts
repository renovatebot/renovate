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
        .filter((line) => line !== '')
        .map((line) => {
          const [version, gitRef, buildDate, newDigest] = line.split(' ');

          return {
            changelogUrl: this.changelogUrl(version, packageType),
            downloadUrl: `${
              registryUrl ?? defaultRegistryUrl
            }builds/${packageName}/${version}.tar.gz`,
            gitRef,
            isStable: this.isStable(version, packageType),
            releaseTimestamp: new Date(buildDate).getTime(),
            version: this.cleanVersion(version, packageType),
            newDigest,
            constraints: this.constraints(version, packageType),
            sourceUrl: this.sourceUrl(gitRef, packageType),
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
  private sourceUrl(gitRef: string, packageType: PackageType): string {
    switch (packageType) {
      case 'elixir':
        return `https://github.com/elixir-lang/elixir/tree/${gitRef}`;
      case 'erlang':
        return `https://github.com/erlang/otp/tree/${gitRef}`;
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

  // eslint-disable-next-line consistent-return
  private changelogUrl(
    version: string,
    packageType: PackageType
  ): string | undefined {
    if (this.isStable(version, packageType)) {
      return undefined;
    }

    switch (packageType) {
      case 'elixir':
        return `https://github.com/elixir-lang/elixir/releases/tag/${version}`;
      case 'erlang':
        return `https://github.com/erlang/otp/releases/tag/${version}`;
    }
  }

  private constraints(
    version: string,
    packageType: PackageType
  ): Record<string, string[]> | undefined {
    if (packageType !== 'elixir') {
      return undefined;
    }

    const otpRequirement = version.match(/-otp-(?<otpVersion>\d+)$/);

    if (!otpRequirement) {
      return undefined;
    }

    return { erlang: [`^${otpRequirement.groups!.otpVersion}.0`] };
  }

  private getPackageDetails(
    packageType: PackageType
  ): Omit<ReleaseResult, 'releases'> {
    let specificDetails: Partial<ReleaseResult>;
    switch (packageType) {
      case 'elixir':
        specificDetails = {
          changelogUrl: 'https://github.com/elixir-lang/elixir/releases',
          homepage: 'https://elixir-lang.org/',
          sourceUrl: 'https://github.com/elixir-lang/elixir',
        };
        break;
      case 'erlang':
        specificDetails = {
          changelogUrl: 'https://github.com/erlang/otp/releases',
          homepage: 'https://www.erlang.org/',
          sourceUrl: 'https://github.com/erlang/otp',
        };
        break;
    }

    return { isPrivate: false, ...specificDetails };
  }
}
