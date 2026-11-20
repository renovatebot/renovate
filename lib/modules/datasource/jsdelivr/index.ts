import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { defaultRegistryUrl } from '../npm/common.ts';
import { NpmDatasource } from '../npm/index.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

import { parseJsDelivrPackageName } from './common.ts';
import { JsDelivrDigestResponse, JsDelivrPackageResponse } from './schema.ts';

export class JsDelivrDatasource extends Datasource {
  static readonly id = 'jsdelivr';

  private readonly npmDatasource: NpmDatasource;

  constructor() {
    super(JsDelivrDatasource.id);

    this.npmDatasource = new NpmDatasource();
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return false;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['https://data.jsdelivr.com/v1/'];
  }

  private async getNpmReleases(
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return await this.npmDatasource.getReleases({
      registryUrl: defaultRegistryUrl,
      packageName,
    });
  }

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      return null;
    }

    const { type, package: parsedPackageName } =
      parseJsDelivrPackageName(packageName);
    const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}`;

    const body = await this.fetchJsonOrNull(url, JsDelivrPackageResponse);
    if (!body) {
      return null;
    }

    return {
      releases: body.versions,
      tags: body.tags,
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { type, package: parsedPackageName } = parseJsDelivrPackageName(
      config.packageName,
    );

    if (type === 'npm') {
      return this.getNpmReleases(parsedPackageName);
    }

    return this.cached(
      {
        key: buildCacheKey('getReleases', type, parsedPackageName),
        public: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { packageName, registryUrl } = config;

    if (!newValue || !registryUrl) {
      return null;
    }

    const {
      type,
      package: parsedPackageName,
      asset,
    } = parseJsDelivrPackageName(packageName);
    const url = `${ensureTrailingSlash(registryUrl)}packages/${type}/${parsedPackageName}@${newValue}?structure=flat`;

    const body = await this.fetchJsonOrNull(url, JsDelivrDigestResponse);
    const file = body?.files.find(
      (file) => file.name.replace(regEx(/^\/+/), '') === asset,
    );
    return file?.hash ? `sha256-${file.hash}` : null;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cached(
      {
        key: buildCacheKey(
          'getDigest',
          config.registryUrl,
          config.packageName,
          newValue,
        ),
        public: true,
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}
