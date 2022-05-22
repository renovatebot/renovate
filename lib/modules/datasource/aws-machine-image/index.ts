import { DescribeImagesCommand, EC2Client, Image } from '@aws-sdk/client-ec2';
import { cache } from '../../../util/cache/package/decorator';
import { Lazy } from '../../../util/lazy';
import * as amazonMachineImageVersioning from '../../versioning/aws-machine-image';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

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

  private readonly ec2: Lazy<EC2Client>;

  private readonly now: number;

  constructor() {
    super(AwsMachineImageDataSource.id);
    this.ec2 = new Lazy(() => new EC2Client({}));
    this.now = Date.now();
  }

  @cache({
    namespace: `datasource-${AwsMachineImageDataSource.id}`,
    key: (serializedAmiFilter: string) =>
      `getSortedAwsMachineImages:${serializedAmiFilter}`,
  })
  async getSortedAwsMachineImages(
    serializedAmiFilter: string
  ): Promise<Image[]> {
    const cmd = new DescribeImagesCommand({
      Filters: JSON.parse(serializedAmiFilter),
    });
    const matchingImages = await this.ec2.getValue().send(cmd);
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
    newValue?: string
  ): Promise<string | null> {
    const images = await this.getSortedAwsMachineImages(serializedAmiFilter);
    if (images.length < 1) {
      return null;
    }

    if (newValue) {
      const newValueMatchingImages = images.filter(
        (image) => image.ImageId === newValue
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
