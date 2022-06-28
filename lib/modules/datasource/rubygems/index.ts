import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { InternalRubyGemsDatasource } from './get';
import { RubyGemsOrgDatasource } from './get-rubygems-org';

export class RubyGemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  constructor() {
    super(RubyGemsDatasource.id);
    this.rubyGemsOrgDatasource = new RubyGemsOrgDatasource(
      RubyGemsDatasource.id
    );
    this.internalRubyGemsDatasource = new InternalRubyGemsDatasource(
      RubyGemsDatasource.id
    );
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly rubyGemsOrgDatasource: RubyGemsOrgDatasource;

  private readonly internalRubyGemsDatasource: InternalRubyGemsDatasource;

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (parseUrl(registryUrl)?.hostname === 'rubygems.org') {
      return this.rubyGemsOrgDatasource.getReleases({ packageName });
    }
    try {
      return await this.internalRubyGemsDatasource.getReleases({
        packageName,
        registryUrl,
      });
    } catch (error) {
      if (error instanceof HttpError && error.response?.statusCode === 404) {
        return this.rubyGemsOrgDatasource.getReleases({
          packageName,
          registryUrl,
        });
      }
      return null;
    }
  }
}
