import {
  type AddonInfo,
  type AddonVersionInfo,
  DescribeAddonVersionsCommand,
  DescribeAddonVersionsResponse,
  EKSClient,
} from '@aws-sdk/client-eks';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '..';
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

// a bad addonVersion that's missing the basic fields.
const addonVersionBad: AddonVersionInfo = {};

/**
 * Testdata for mock implementation of EKSClient
 */
const vpcCniAddonInfo: AddonInfo = {
  addonName: 'vpc-cni',
  type: 'networking',
  addonVersions: [addonVersion1, addonVersion2, addonVersionBad],
  publisher: 'eks',
  owner: 'aws',
};

const mockAddon: DescribeAddonVersionsResponse = {
  addons: [vpcCniAddonInfo],
};

const mockEmpty: DescribeAddonVersionsResponse = {
  addons: [],
};

const mockNull: DescribeAddonVersionsResponse = {};

const mockNullAddonVersions: DescribeAddonVersionsResponse = {
  addons: [
    {
      addonName: 'non-existing-addon',
      type: 'networking',
      publisher: 'eks',
      owner: 'aws',
      // missing addonVersions
    },
  ],
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
    it.each([
      ['null', mockNull],
      ['empty', mockEmpty],
      ['nullAddonVersions', mockNullAddonVersions],
    ])('returned %s addons to be null', async (_, mocked) => {
      mockDescribeAddonVersionsCommand(mocked);
      const res = await getPkgReleases({
        datasource,
        packageName:
          '{"kubernetesVersion":"1.30","addonName":"non-existing-addon"}',
      });
      expect(res).toBeNull();
      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({
        kubernetesVersion: '1.30',
        addonName: 'non-existing-addon',
        maxResults: 1,
      });
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
            version: addonVersion1.addonVersion,
          },
          {
            version: addonVersion2.addonVersion,
          },
        ],
      });
      expect(eksMock.call(0).args[0].input).toEqual({
        kubernetesVersion: '1.30',
        addonName: 'vpc-cni',
        maxResults: 1,
      });
      expect(await eksMock.call(0).returnValue).toEqual({
        addons: [vpcCniAddonInfo],
        nextToken: 'mars-east-1',
      });
    });
  });
});
