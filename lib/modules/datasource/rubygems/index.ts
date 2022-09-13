import { EndpointNotSupportedError } from '../../../types/errors/endpoint-not-supported-error';
import { cache } from '../../../util/cache/package/decorator';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { InternalRubyGemsDatasource } from './get';
import { VersionsDatasource } from './versions-datasource';

export class RubyGemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  constructor() {
    super(RubyGemsDatasource.id);
    this.internalRubyGemsDatasource = new InternalRubyGemsDatasource(
      RubyGemsDatasource.id
    );
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly versionsDatasources: {
    [key: string]: VersionsDatasource;
  } = {};

  private readonly internalRubyGemsDatasource: InternalRubyGemsDatasource;

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    if (!this.versionsDatasources[registryUrl]) {
      this.versionsDatasources[registryUrl] = new VersionsDatasource(
        RubyGemsDatasource.id,
        registryUrl
      );
    }

    try {
      return await this.versionsDatasources[registryUrl].getReleases({
        packageName,
        registryUrl,
      });
    } catch (error) {
      if (error instanceof EndpointNotSupportedError) {
        return this.internalRubyGemsDatasource.getReleases({
          packageName,
          registryUrl,
        });
      }
      throw error;
    }
  }
}
