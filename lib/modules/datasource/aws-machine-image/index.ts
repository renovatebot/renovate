import type { Filter, Image } from '@aws-sdk/client-ec2';
import { DescribeImagesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { coerceArray } from '../../../util/array.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import * as amazonMachineImageVersioning from '../../versioning/aws-machine-image/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import type { AwsClientConfig, ParsedConfig } from './types.ts';

export class AwsMachineImageDatasource extends Datasource {
  static readonly id = 'aws-machine-image';

  override readonly defaultVersioning = amazonMachineImageVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `CreationDate` field in the results.';

  override readonly defaultConfig = {
    // Because AMIs don't follow any versioning scheme, we override commitMessageExtra to remove the 'v'
    commitMessageExtra: 'to {{{newVersion}}}',
    prBodyColumns: ['Change', 'Image'],
    prBodyDefinitions: {
      Image: '```{{{newDigest}}}```',
    },
    digest: {
      // Because newDigestShort will allways be 'amazon-' we override to print the name of the AMI
      commitMessageExtra: 'to {{{newDigest}}}',
      prBodyColumns: ['Image'],
      prBodyDefinitions: {
        Image: '```{{{newDigest}}}```',
      },
    },
  };

  private readonly now: number;

  constructor() {
    super(AwsMachineImageDatasource.id);
    this.now = Date.now();
  }

  private isAmiFilter(config: Filter | AwsClientConfig): config is Filter {
    return 'Name' in config && 'Values' in config;
  }

  private getEC2Client(config: AwsClientConfig): EC2Client {
    const { profile, region } = config;
    const { password, token, username } = hostRules.find({
      hostType: AwsMachineImageDatasource.id,
    });
    return new EC2Client({
      region,
      credentials:
        username && password
          ? {
              accessKeyId: username,
              secretAccessKey: password,
              sessionToken: token,
            }
          : fromNodeProviderChain({ profile }),
    });
  }

  private getAmiFilterCommand(filter: Filter[]): DescribeImagesCommand {
    return new DescribeImagesCommand({
      Filters: filter,
    });
  }

  loadConfig(serializedAmiFilter: string): [Filter[], AwsClientConfig] {
    const parsedConfig: ParsedConfig = JSON.parse(serializedAmiFilter);
    const filters = [];
    let config = {};
    for (const elem of parsedConfig) {
      if (this.isAmiFilter(elem)) {
        // Separate actual AMI filters from aws client config
        filters.push(elem);
      } else {
        // merge  config objects if there are multiple
        config = Object.assign(config, elem);
      }
    }
    return [filters, config];
  }

  private async fetchSortedAwsMachineImages(
    serializedAmiFilter: string,
  ): Promise<Image[]> {
    const [amiFilter, clientConfig] = this.loadConfig(serializedAmiFilter);
    const amiFilterCmd = this.getAmiFilterCommand(amiFilter);
    const ec2Client = this.getEC2Client(clientConfig);
    const matchingImages = await ec2Client.send(amiFilterCmd);
    matchingImages.Images = coerceArray(matchingImages.Images);
    return matchingImages.Images.sort((image1, image2) => {
      const ts1 = image1.CreationDate
        ? Date.parse(image1.CreationDate)
        : /* v8 ignore next -- AWS SDK types CreationDate as optional, but EC2 always returns it for images */ 0; // TODO: add date coersion util

      const ts2 = image2.CreationDate
        ? Date.parse(image2.CreationDate)
        : /* v8 ignore next -- AWS SDK types CreationDate as optional, but EC2 always returns it for images */ 0; // TODO: add date coersion util
      return ts1 - ts2;
    });
  }

  getSortedAwsMachineImages(serializedAmiFilter: string): Promise<Image[]> {
    return this.cached(
      {
        key: `getSortedAwsMachineImages:${serializedAmiFilter}`,
      },
      () => this.fetchSortedAwsMachineImages(serializedAmiFilter),
    );
  }

  private async fetchDigest(
    { packageName: serializedAmiFilter }: GetReleasesConfig,
    newValue?: string,
  ): Promise<string | null> {
    const images = await this.getSortedAwsMachineImages(serializedAmiFilter);
    if (images.length < 1) {
      return null;
    }

    if (newValue) {
      const newValueMatchingImages = images.filter(
        (image) => image.ImageId === newValue,
      );
      if (
        newValueMatchingImages.length === 1 &&
        newValueMatchingImages[0].Name
      ) {
        return newValueMatchingImages[0].Name;
      }
      return null;
    }

    return images.at(-1)!.Name ?? null;
  }

  override getDigest(
    config: GetReleasesConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cached(
      {
        key: `getDigest:${config.packageName}:${newValue ?? ''}`,
        fallback: true,
      },
      () => this.fetchDigest(config, newValue),
    );
  }

  private async fetchReleases({
    packageName: serializedAmiFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const images = await this.getSortedAwsMachineImages(serializedAmiFilter);
    if (!images.length || !images.at(-1)!.ImageId) {
      return null;
    }
    return {
      releases: images.map((image) => ({
        version: image.ImageId!,
        releaseTimestamp: asTimestamp(image.CreationDate),
        isDeprecated:
          Date.parse(image.DeprecationTime ?? this.now.toString()) < this.now,
        newDigest: image.Name,
      })),
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `getReleases:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
