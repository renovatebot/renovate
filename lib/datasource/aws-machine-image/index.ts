import { DescribeImagesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { cache } from '../../util/cache/package/decorator';
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

  readonly ec2: EC2Client;

  readonly now: number;

  constructor() {
    super(AwsMachineImageDataSource.id);
    this.ec2 = new EC2Client({});
    this.now = Date.now();
  }

  override async getDigest(
    { lookupName: serializedAmiFilter }: GetReleasesConfig,
    newValue?: string
  ): Promise<string | null> {
    if (newValue) {
      const cmd = new DescribeImagesCommand({
        ImageIds: [newValue],
        Filters: JSON.parse(serializedAmiFilter),
      });
      const matchingImages = await this.ec2.send(cmd);
      if (matchingImages.Images === undefined) {
        return null;
      }
      const latestImage = matchingImages.Images.sort(
        (image1, image2) =>
          Date.parse(image1.CreationDate) - Date.parse(image2.CreationDate)
      ).pop();
      const digest = latestImage.Name;
      return digest;
    }
    const getReleasesResult = await this.getReleases({
      lookupName: serializedAmiFilter,
    });

    if (getReleasesResult === null) {
      return null;
    }
    return getReleasesResult.releases[0].newDigest ?? null;
  }

  @cache({
    namespace: `datasource-${AwsMachineImageDataSource.id}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}:${lookupName}`,
  })
  async getReleases({
    lookupName: serializedAmiFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const cmd = new DescribeImagesCommand({
      Filters: JSON.parse(serializedAmiFilter),
    });
    const matchingImages = await this.ec2.send(cmd);
    if (matchingImages.Images === undefined) {
      return null;
    }
    const latestImage = matchingImages.Images.sort(
      (image1, image2) =>
        Date.parse(image1.CreationDate) - Date.parse(image2.CreationDate)
    ).pop();
    return {
      releases: [
        {
          version: latestImage.ImageId,
          releaseTimestamp: latestImage.CreationDate,
          isDeprecated:
            (Date.parse(latestImage.DeprecationTime) ?? this.now) < this.now,
          newDigest: latestImage.Name,
        },
      ],
    };
  }
}
