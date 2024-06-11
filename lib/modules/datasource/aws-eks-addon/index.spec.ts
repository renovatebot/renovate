import {
  type AddonInfo,
  type AddonVersionInfo,
  DescribeAddonVersionsCommand,
  DescribeAddonVersionsResponse,
  EKSClient,
} from '@aws-sdk/client-eks';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '../index';
import { AwsEKSAddonDataSource } from '.';

const datasource = AwsEKSAddonDataSource.id;
const eksMock = mockClient(EKSClient);

const addonVersion1: AddonVersionInfo = {
  addonVersion: 'v1.18.1-eksbuild.1',
  architecture: ['amd64', 'arm64'],
  compatibilities: [
    {
      clusterVersion: '1.30',
      platformVersions: ['*'],
      defaultVersion: false,
    },
  ],
  requiresConfiguration: false,
};

const addonVersion2: AddonVersionInfo = {
  addonVersion: 'v1.18.2-eksbuild.1',
  architecture: ['amd64', 'arm64'],
  compatibilities: [
    {
      clusterVersion: '1.30',
      platformVersions: ['*'],
      defaultVersion: false,
    },
  ],
  requiresConfiguration: false,
};

/**
 * Testdata for mock implementation of EKSClient
 */
const vpcCniAddonInfo: AddonInfo = {
  addonName: 'vpc-cni',
  type: 'networking',
  addonVersions: [addonVersion1, addonVersion2],
  publisher: 'eks',
  owner: 'aws',
};

const mockAddon: DescribeAddonVersionsResponse = {
  addons: [vpcCniAddonInfo],
};

const mockEmpty: DescribeAddonVersionsResponse = {
  addons: [],
};

function mockDescribeAddonVersionsCommand(
  result: DescribeAddonVersionsResponse,
): void {
  eksMock.reset();
  eksMock.on(DescribeAddonVersionsCommand).resolves(result);
}

function mockDescribeAddonVersionsCommandWithRegion(
  result: DescribeAddonVersionsResponse,
): void {
  eksMock.reset();
  eksMock
    .on(DescribeAddonVersionsCommand)
    .callsFake(async (input, getClient) => {
      const client = getClient();
      const region = await client.config.region();
      return {
        ...result,
        // put the client region as nextToken
        // so that when we assert on the snapshot, we also verify that region from packageName is
        // passed to aws client.
        nextToken: region,
      };
    });
}

describe('modules/datasource/aws-eks-addon/index', () => {
  describe('getPkgReleases()', () => {
    it('without returned addons to be null', async () => {
      mockDescribeAddonVersionsCommand(mockEmpty);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '{"kubernetesVersion":"1.30","addonName":"non-existing-addon"}',
      });
      expect(res).toBeNull();
      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args).toMatchSnapshot();
      expect(await eksMock.call(0).returnValue).toMatchSnapshot();
    });

    it('with matched addon to return all versions of the addon', async () => {
      mockDescribeAddonVersionsCommandWithRegion(mockAddon);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '{"kubernetesVersion":"1.30","addonName":"vpc-cni","region":"mars-east-1"}',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: false,
            version: addonVersion1.addonVersion,
          },
          {
            isDeprecated: false,
            version: addonVersion2.addonVersion,
          },
        ],
      });
      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.calls()[0].args).toMatchSnapshot();
      expect(await eksMock.call(0).returnValue).toMatchSnapshot();
    });
  });
});
