import {
  DescribeImagesCommand,
  DescribeImagesResult,
  EC2Client,
  Image,
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import { getDigest, getPkgReleases } from '..';
import { AwsMachineImageDataSource } from '.';

const datasource = AwsMachineImageDataSource.id;
const ec2Mock = mockClient(EC2Client);

/**
 * Testdata for mock implementation of EC2Client
 * image1 to image3 from oldest to newest image
 */
const image1: Image = {
  Architecture: 'x86_64',
  CreationDate: '2021-08-13T17:47:12.000Z',
  ImageId: 'ami-02ce3d9008cab69cb',
  ImageLocation: 'amazon/amazon-eks-node-1.21-v20210813',
  ImageType: 'machine',
  Public: true,
  OwnerId: '602401143452',
  PlatformDetails: 'Linux/UNIX',
  UsageOperation: 'RunInstances',
  State: 'available',
  BlockDeviceMappings: [
    {
      DeviceName: '/dev/xvda',
      Ebs: {
        DeleteOnTermination: true,
        SnapshotId: 'snap-0546beb61976e8017',
        VolumeSize: 20,
        VolumeType: 'gp2',
        Encrypted: false,
      },
    },
  ],
  Description:
    'EKS Kubernetes Worker AMI with AmazonLinux2 image, (k8s: 1.21.2, docker: 19.03.13ce-1.amzn2, containerd: 1.4.6-2.amzn2)',
  EnaSupport: true,
  Hypervisor: 'xen',
  ImageOwnerAlias: 'amazon',
  Name: 'amazon-eks-node-1.21-v20210813',
  RootDeviceName: '/dev/xvda',
  RootDeviceType: 'ebs',
  SriovNetSupport: 'simple',
  VirtualizationType: 'hvm',
};

const image2: Image = {
  Architecture: 'x86_64',
  CreationDate: '2021-08-26T19:31:41.000Z',
  DeprecationTime: '2021-08-14T17:47:12.000Z',
  ImageId: 'ami-020d418c09883b165',
  ImageLocation: 'amazon/amazon-eks-node-1.21-v20210826',
  ImageType: 'machine',
  Public: true,
  OwnerId: '602401143452',
  PlatformDetails: 'Linux/UNIX',
  UsageOperation: 'RunInstances',
  State: 'available',
  BlockDeviceMappings: [
    {
      DeviceName: '/dev/xvda',
      Ebs: {
        DeleteOnTermination: true,
        SnapshotId: 'snap-01ba16a8ec8087603',
        VolumeSize: 20,
        VolumeType: 'gp2',
        Encrypted: false,
      },
    },
  ],
  Description:
    'EKS Kubernetes Worker AMI with AmazonLinux2 image, (k8s: 1.21.2, docker: 19.03.13ce-1.amzn2, containerd: 1.4.6-2.amzn2)',
  EnaSupport: true,
  Hypervisor: 'xen',
  ImageOwnerAlias: 'amazon',
  Name: 'amazon-eks-node-1.21-v20210826',
  RootDeviceName: '/dev/xvda',
  RootDeviceType: 'ebs',
  SriovNetSupport: 'simple',
  VirtualizationType: 'hvm',
};

const image3: Image = {
  Architecture: 'x86_64',
  CreationDate: '2021-09-14T22:00:24.000Z',
  ImageId: 'ami-05f83986b0fe58ada',
  ImageLocation: 'amazon/amazon-eks-node-1.21-v20210914',
  ImageType: 'machine',
  Public: true,
  OwnerId: '602401143452',
  PlatformDetails: 'Linux/UNIX',
  UsageOperation: 'RunInstances',
  State: 'available',
  BlockDeviceMappings: [
    {
      DeviceName: '/dev/xvda',
      Ebs: {
        DeleteOnTermination: true,
        SnapshotId: 'snap-0c6f79c3983fd8e1a',
        VolumeSize: 20,
        VolumeType: 'gp2',
        Encrypted: false,
      },
    },
  ],
  Description:
    'EKS Kubernetes Worker AMI with AmazonLinux2 image, (k8s: 1.21.2, docker: 19.03.13ce-1.amzn2, containerd: 1.4.6-2.amzn2)',
  EnaSupport: true,
  Hypervisor: 'xen',
  ImageOwnerAlias: 'amazon',
  Name: 'amazon-eks-node-1.21-v20210914',
  RootDeviceName: '/dev/xvda',
  RootDeviceType: 'ebs',
  SriovNetSupport: 'simple',
  VirtualizationType: 'hvm',
};

const mock3Images: DescribeImagesResult = {
  Images: [image3, image1, image2],
};

const mock1Image: DescribeImagesResult = {
  Images: [image3],
};

const mockEmpty: DescribeImagesResult = {};

function mockDescribeImagesCommand(result: DescribeImagesResult): void {
  ec2Mock.reset();
  ec2Mock.on(DescribeImagesCommand).resolves(result);
}

describe('modules/datasource/aws-machine-image/index', () => {
  describe('getSortedAwsMachineImages()', () => {
    it('with 3 returned images', async () => {
      mockDescribeImagesCommand(mock3Images);
      const ec2DataSource = new AwsMachineImageDataSource();
      const res = await ec2DataSource.getSortedAwsMachineImages(
        '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["3images"]}]',
      );
      expect(res).toStrictEqual([image1, image2, image3]);
      expect(ec2Mock.calls()).toHaveLength(1);
      expect(ec2Mock.calls()[0].args).toMatchInlineSnapshot(`
        [
          DescribeImagesCommand {
            "input": {
              "Filters": [
                {
                  "Name": "owner-id",
                  "Values": [
                    "602401143452",
                  ],
                },
                {
                  "Name": "name",
                  "Values": [
                    "3images",
                  ],
                },
              ],
            },
            "middlewareStack": {
              "add": [Function],
              "addRelativeTo": [Function],
              "applyToStack": [Function],
              "clone": [Function],
              "concat": [Function],
              "identify": [Function],
              "remove": [Function],
              "removeByTag": [Function],
              "resolve": [Function],
              "use": [Function],
            },
          },
        ]
      `);
    });

    it('with 1 returned image', async () => {
      mockDescribeImagesCommand(mock1Image);
      const ec2DataSource = new AwsMachineImageDataSource();
      const res = await ec2DataSource.getSortedAwsMachineImages(
        '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["1image"]}]',
      );
      expect(res).toStrictEqual([image3]);
      expect(ec2Mock.calls()).toHaveLength(1);
      expect(ec2Mock.calls()[0].args).toMatchInlineSnapshot(`
        [
          DescribeImagesCommand {
            "input": {
              "Filters": [
                {
                  "Name": "owner-id",
                  "Values": [
                    "602401143452",
                  ],
                },
                {
                  "Name": "name",
                  "Values": [
                    "1image",
                  ],
                },
              ],
            },
            "middlewareStack": {
              "add": [Function],
              "addRelativeTo": [Function],
              "applyToStack": [Function],
              "clone": [Function],
              "concat": [Function],
              "identify": [Function],
              "remove": [Function],
              "removeByTag": [Function],
              "resolve": [Function],
              "use": [Function],
            },
          },
        ]
      `);
    });

    it('without returned images', async () => {
      mockDescribeImagesCommand(mockEmpty);
      const ec2DataSource = new AwsMachineImageDataSource();
      const res = await ec2DataSource.getSortedAwsMachineImages(
        '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["noiamge"]}]',
      );
      expect(res).toStrictEqual([]);
      expect(ec2Mock.calls()).toHaveLength(1);
      expect(ec2Mock.calls()[0].args).toMatchInlineSnapshot(`
        [
          DescribeImagesCommand {
            "input": {
              "Filters": [
                {
                  "Name": "owner-id",
                  "Values": [
                    "602401143452",
                  ],
                },
                {
                  "Name": "name",
                  "Values": [
                    "noiamge",
                  ],
                },
              ],
            },
            "middlewareStack": {
              "add": [Function],
              "addRelativeTo": [Function],
              "applyToStack": [Function],
              "clone": [Function],
              "concat": [Function],
              "identify": [Function],
              "remove": [Function],
              "removeByTag": [Function],
              "resolve": [Function],
              "use": [Function],
            },
          },
        ]
      `);
    });
  });

  describe('getDigest()', () => {
    it('without newValue, without returned images to be null', async () => {
      mockDescribeImagesCommand(mockEmpty);
      const res = await getDigest({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["without newValue, without returned images to be null"]}]',
      });
      expect(res).toBeNull();
    });

    it('without newValue, with one matching image to return that image', async () => {
      mockDescribeImagesCommand(mock1Image);
      const res = await getDigest({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["without newValue, with one matching image to return that image"]}]',
      });
      expect(res).toStrictEqual(image3.Name);
    });

    it('without newValue, with 3 matching image to return the newest image', async () => {
      mockDescribeImagesCommand(mock3Images);
      const res = await getDigest({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["without newValue, with 3 matching image to return the newest image"]}]',
      });
      expect(res).toStrictEqual(image3.Name);
    });

    it('with matching newValue, with 3 matching image to return the matching image', async () => {
      mockDescribeImagesCommand(mock3Images);
      const res = await getDigest(
        {
          datasource,
          packageName:
            '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["with matching newValue, with 3 matching image to return the matching image"]}]',
        },
        image1.ImageId,
      );
      expect(res).toStrictEqual(image1.Name);
    });

    it('with not matching newValue, with 3 matching images to return the matching image', async () => {
      mockDescribeImagesCommand(mock3Images);
      const res = await getDigest(
        {
          datasource,
          packageName:
            '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["with not matching newValue, with 3 matching images to return the matching image"]}]',
        },
        'will never match',
      );
      expect(res).toBeNull();
    });
  });

  describe('getPkgReleases()', () => {
    it('without returned images to be null', async () => {
      mockDescribeImagesCommand(mockEmpty);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["without returned images to be null"]}]',
      });
      expect(res).toBeNull();
    });

    it('with one matching image to return that image', async () => {
      mockDescribeImagesCommand(mock1Image);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["with one matching image to return that image"]}]',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: false,
            newDigest: image3.Name,
            releaseTimestamp: image3.CreationDate,
            version: image3.ImageId,
          },
        ],
      });
    });

    it('with one deprecated matching image to return that image', async () => {
      mockDescribeImagesCommand({ Images: [image2] });
      const res = await getPkgReleases({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["with one deprecated matching image to return that image"]}]',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: true,
            newDigest: image2.Name,
            releaseTimestamp: image2.CreationDate,
            version: image2.ImageId,
          },
        ],
      });
    });

    it('with 3 matching image to return the newest image', async () => {
      mockDescribeImagesCommand(mock3Images);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["with 3 matching image to return the newest image"]}]',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: false,
            newDigest: image3.Name,
            releaseTimestamp: image3.CreationDate,
            version: image3.ImageId,
          },
        ],
      });
    });
  });

  describe('loadConfig()', () => {
    const ec2DataSource = new AwsMachineImageDataSource();

    it('loads filters without aws config', () => {
      const res = ec2DataSource.loadConfig(
        '[{"Name":"testname","Values":["testvalue"]}]',
      );
      expect(res).toEqual([
        [
          {
            Name: 'testname',
            Values: ['testvalue'],
          },
        ],
        {},
      ]);
    });

    it('loads filters with multiple aws configs', () => {
      const res = ec2DataSource.loadConfig(
        '[{"Name":"testname","Values":["testvalue"]},{"region":"us-west-2"},{"profile":"test-profile"},{"region":"eu-central-1"}]',
      );
      expect(res).toEqual([
        [
          {
            Name: 'testname',
            Values: ['testvalue'],
          },
        ],
        {
          region: 'eu-central-1',
          profile: 'test-profile',
        },
      ]);
    });
  });
});
