import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

const PROVIDER_NAMESPACE_REGEX = regEx(/^(?<providerNamespace>.*?)\//);

export class AzureRestApiSpecDatasource extends Datasource {
  static readonly id = 'azure-rest-api-spec';

  constructor() {
    super(AzureRestApiSpecDatasource.id);
  }

  // TODO caching via @cache decorator
  getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const { packageName } = getReleasesConfig;

    const providerNamespace =
      AzureRestApiSpecDatasource.parseProviderNamespace(packageName);

    if (!providerNamespace) {
      // TODO: just return null when this method is async
      return Promise.resolve(null);
    }

    // TODO: get provider namespace path in github repo

    // TODO: get preview and stable versions for provider namespace
    throw new Error('Method not implemented.');
  }

  private static parseProviderNamespace(
    packageName: string
  ): string | undefined {
    const match = PROVIDER_NAMESPACE_REGEX.exec(packageName);
    return match?.groups?.providerNamespace;
  }
}
