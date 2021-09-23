/* eslint-disable @typescript-eslint/no-unused-vars */
import { DescribeImagesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { Datasource } from '../datasource';
import { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class AwsMachineImageDataSource extends Datasource {
  static readonly id = 'amazon-machine-image';

  readonly ec2: EC2Client;

  readonly now: number;

  constructor() {
    super(AwsMachineImageDataSource.id);
    this.ec2 = new EC2Client({});
    this.now = Date.now();
  }

  async getReleases({
    lookupName: serializedAmiFilter,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // eslint-disable-next-line no-console
    console.log(serializedAmiFilter);
    const amiFilters = JSON.parse(serializedAmiFilter);
    const cmd = new DescribeImagesCommand({
      Filters: amiFilters,
    });
    const matchingImages = await this.ec2.send(cmd);
    const sortedImages = matchingImages.Images?.sort(
      (image1, image2) =>
        Date.parse(image1.CreationDate) - Date.parse(image2.CreationDate)
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(amiFilters, null, 2));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(sortedImages, null, 2));

    const ret = {
      releases: sortedImages.map(
        (image): Release => ({
          version: image.ImageId,
          releaseTimestamp: image.CreationDate,
          isDeprecated:
            (Date.parse(image.DeprecationTime) ?? this.now) < this.now,
        })
      ),
    };
    console.log(JSON.stringify(ret, null, 2));
    return ret;
  }
}
