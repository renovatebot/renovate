import { DescribeImagesCommand, EC2Client } from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '..';
import { AwsMachineImageDataSource } from '.';

const datasource = AwsMachineImageDataSource.id;
const ec2Mock = mockClient(EC2Client);

beforeEach(() => {
  ec2Mock.reset();
});

describe('datasource/aws-machine-image/index', () => {
  describe('getReleases', () => {
    it('returns images from the aws api', async () => {
      ec2Mock.on(DescribeImagesCommand).resolves({
        Images: [
          {
            Architecture: 'x86_64',
            CreationDate: '2021-08-26T19:31:41.000Z',
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
          },
          {
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
          },
          {
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
          },
        ],
      });
      const res = await getPkgReleases({
        datasource,
        depName:
          '[{"Name":"owner-id","Values":["602401143452"]},{"Name":"name","Values":["amazon-eks-node-1.21-*"]}]',
      });
      console.log(res);
      expect(res).toMatchSnapshot();
      //expect(res.releases).toHaveLength(3);
      expect(ec2Mock.calls()).toMatchSnapshot();
    });
  });
});
