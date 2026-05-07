import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../../../logger/index.ts';
import type { HttpOptions } from '../../../util/http/types.ts';
import { joinUrlParts, trimTrailingSlash } from '../../../util/url.ts';
import { id as versioning } from '../../versioning/loose/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import {
  AzureComputeGalleryPackage,
  AzureComputeGalleryVersions,
  type AzureComputeGalleryVersions as AzureComputeGalleryVersionsResult,
} from './schema.ts';

const AZURE_MANAGEMENT_URL = 'https://management.azure.com';
const AZURE_COMPUTE_API_VERSION = '2025-03-03';

interface AzureAccessToken {
  token: string;
}

interface AzureTokenCredential {
  getToken(scopes: string | string[]): Promise<AzureAccessToken | null>;
}

export class AzureComputeGalleryDatasource extends Datasource {
  static readonly id = 'azure-compute-gallery';

  private readonly credential: AzureTokenCredential;

  override readonly defaultRegistryUrls = [AZURE_MANAGEMENT_URL];

  override readonly defaultVersioning = versioning;

  override readonly caching = true;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `properties.publishingProfile.publishedDate` field in the results.';

  constructor(credential: AzureTokenCredential = new DefaultAzureCredential()) {
    super(AzureComputeGalleryDatasource.id);
    this.credential = credential;
  }

  private getRegistryUrl(registryUrl?: string): string {
    return trimTrailingSlash(registryUrl ?? AZURE_MANAGEMENT_URL);
  }

  private getTokenScope(registryUrl: string): string {
    return `${new URL(registryUrl).origin}/.default`;
  }

  private async getHttpOptions(registryUrl: string): Promise<HttpOptions> {
    const accessToken = await this.credential.getToken(
      this.getTokenScope(registryUrl),
    );

    if (!accessToken?.token) {
      throw new Error('Failed to get Azure access token');
    }

    return {
      headers: { authorization: `Bearer ${accessToken.token}` },
    };
  }

  private getVersionsUrl(
    registryUrl: string,
    config: AzureComputeGalleryPackage,
  ): string {
    const path = joinUrlParts(
      registryUrl,
      'subscriptions',
      encodeURIComponent(config.subscriptionId),
      'resourceGroups',
      encodeURIComponent(config.resourceGroupName),
      'providers',
      'Microsoft.Compute',
      'galleries',
      encodeURIComponent(config.galleryName),
      'images',
      encodeURIComponent(config.galleryImageName),
      'versions',
    );
    return `${path}?api-version=${AZURE_COMPUTE_API_VERSION}`;
  }

  private async getGalleryImageVersions(
    registryUrl: string,
    config: AzureComputeGalleryPackage,
  ): Promise<Release[]> {
    const httpOptions = await this.getHttpOptions(registryUrl);
    const seenUrls = new Set<string>();
    const versions: Release[] = [];
    let url: string | undefined = this.getVersionsUrl(registryUrl, config);

    while (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      const { body: versionPage }: { body: AzureComputeGalleryVersionsResult } =
        await this.http.getJson(url, httpOptions, AzureComputeGalleryVersions);
      versions.push(...versionPage.value);
      url = versionPage.nextLink;
    }

    return versions;
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const parsedPackage = AzureComputeGalleryPackage.safeParse(packageName);
    if (!parsedPackage.success) {
      logger.warn(
        { err: parsedPackage.error, packageName },
        'Error parsing Azure Compute Gallery packageName.',
      );
      return null;
    }

    const releases = await this.getGalleryImageVersions(
      this.getRegistryUrl(registryUrl),
      parsedPackage.data,
    ).catch((err: Error) => this.handleGenericErrors(err));

    if (!releases.length) {
      return null;
    }

    return { releases, isPrivate: true };
  }
}
