import {
  DescribeImagesCommand,
  EC2Client,
  Filter,
  Image,
} from '@aws-sdk/client-ec2';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { cache } from '../../../util/cache/package/decorator';
import * as amazonMachineImageVersioning from '../../versioning/aws-machine-image';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { AwsClientConfig, ParsedConfig } from './types';

export class AwsMachineImageDataSource extends Datasource {
  static readonly id = 'aws-machine-image';

  override readonly defaultVersioning = amazonMachineImageVersioning.id;

  override readonly caching = true;

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
    super(AwsMachineImageDataSource.id);
    this.now = Date.now();
  }

  private isAmiFilter(config: Filter | AwsClientConfig): config is Filter {
    return 'Name' in config && 'Values' in config;
  }

  private getEC2Client(config: AwsClientConfig): EC2Client {
    const { profile, region } = config;
    return new EC2Client({
      region,
      credentials: fromNodeProviderChain({ profile }),
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

  @cache({
    namespace: `datasource-${AwsMachineImageDataSource.id}`,
    key: (serializedAmiFilter: string) =>
      `getSortedAwsMachineImages:${serializedAmiFilter}`,
  })
  async getSortedAwsMachineImages(
    serializedAmiFilter: string,
  ): Promise<Image[]> {
    const [amiFilter, clientConfig] = this.loadConfig(serializedAmiFilter);
    const amiFilterCmd = this.getAmiFilterCommand(amiFilter);
    const ec2Client = this.getEC2Client(clientConfig);
    const matchingImages = await ec2Client.send(amiFilterCmd);
    matchingImages.Images = matchingImages.Images ?? [];
    return matchingImages.Images.sort((image1, image2) => {
      const ts1 = image1.CreationDate
        ? Date.parse(image1.CreationDate)
        : /* istanbul ignore next */ 0;

      const ts2 = image2.CreationDate
        ? Date.parse(image2.CreationDate)
        : /* istanbul ignore next */ 0;
      return ts1 - ts2;
    });
  }

  @cache({
    namespace: `datasource-${AwsMachineImageDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig, newValue: string) =>
      `getDigest:${packageName}:${newValue ?? ''}`,
  })
  override async getDigest(
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
      if (newValueMatchingImages.length === 1) {
        return (
          newValueMatchingImages[0].Name ?? /* istanbul ignore next */ null
        );
      }
      return null;
    }

    const res = await this.getReleases({ packageName: serializedAmiFilter });
    return res?.releases?.[0]?.newDigest ?? /* istanbul ignore next */ null;
  }

  @cache({
    namespace: `datasource-${AwsMachineImageDataSource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName: serializedAmiFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const images = await this.getSortedAwsMachineImages(serializedAmiFilter);
    const latestImage = images[images.length - 1];
    if (!latestImage?.ImageId) {
      return null;
    }
    return {
      releases: [
        {
          version: latestImage.ImageId,
          releaseTimestamp: latestImage.CreationDate,
          isDeprecated:
            Date.parse(latestImage.DeprecationTime ?? this.now.toString()) <
            this.now,
          newDigest: latestImage.Name,
        },
      ],
    };
  }
}
