/* eslint-disable @typescript-eslint/no-unused-vars */
import { DescribeImagesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { cache } from '../../util/cache/package/decorator';
import * as amazonMachineImageVersioning from '../../versioning/aws-machine-image';
import { Datasource } from '../datasource';
import { GetReleasesConfig, ReleaseResult } from '../types';

export class AwsMachineImageDataSource extends Datasource {
  static readonly id = 'aws-machine-image';

  override readonly defaultVersioning = amazonMachineImageVersioning.id;

  override readonly caching = true;

  override readonly defaultConfig = {
    pinDigest: true,
    commitMessageTopic:
      'AWS Machine Image {{{depName}}} in ({{#if packageFileDir}}{{{packageFileDir}}}/{{/if}}{{{packageFile}}})',
    commitMessageExtra: '\nto {{{newVersion}}}',
    branchTopic:
      'ami/{{#if packageFileDir}}{{{packageFileDir}}}/{{/if}}{{{packageFile}}}#{{{depName}}}',
    prBodyNotes:
      'The new aws machine image was looked up via the aws api with the following filter:\n```yaml\n{{{stringToPrettyJSON lookupName}}}\n```',
    prBodyColumns: ['Change', 'Image'],
    prBodyDefinitions: {
      Image: '```{{{newDigest}}}```',
    },
    digest: {
      commitMessageAction: 'Set',
      commitMessageTopic:
        'AWS Machine Image Name {{{depName}}} in ({{#if packageFileDir}}{{{packageFileDir}}}/{{/if}}{{{packageFile}}})',
      commitMessageExtra: '\nto {{{newDigest}}}',
      branchTopic:
        'amidigest/{{#if packageFileDir}}{{{packageFileDir}}}/{{/if}}{{{packageFile}}}#{{{depName}}}',
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
    const cmd = new DescribeImagesCommand({
      ImageIds: [newValue],
      Filters: JSON.parse(serializedAmiFilter),
    });
    const matchingImages = await this.ec2.send(cmd);
    const latestImage = matchingImages.Images?.sort(
      (image1, image2) =>
        Date.parse(image1.CreationDate) - Date.parse(image2.CreationDate)
    ).pop();
    const digest = latestImage.Name;
    return digest;
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
    const latestImage = matchingImages.Images?.sort(
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
