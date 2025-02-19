import {
  type AddonInfo,
  DescribeAddonVersionsCommand,
  type DescribeAddonVersionsResponse,
  EKSClient,
} from '@aws-sdk/client-eks';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '..';
import { logger } from '../../../../test/util';

import { AwsEKSAddonDataSource } from '.';

const datasource = AwsEKSAddonDataSource.id;
const eksMock = mockClient(EKSClient);

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

const addonInfo: AddonInfo = {
  addonName: 'vpc-cni',
  type: 'networking',
  addonVersions: [
    {
      addonVersion: 'v1.19.0-eksbuild.1',
      architecture: ['amd64', 'arm64'],
      compatibilities: [
        {
          clusterVersion: '1.31',
          defaultVersion: true,
        },
        {
          clusterVersion: '1.30',
          defaultVersion: true,
        },
        {
          clusterVersion: '1.29',
          defaultVersion: true,
        },
      ],
    },
    {
      addonVersion: 'v1.18.1-eksbuild.1',
      architecture: ['amd64', 'arm64'],
      compatibilities: [
        {
          clusterVersion: '1.30',
          defaultVersion: false,
        },
      ],
    },
    {
      addonVersion: 'v1.18.2-eksbuild.1',
      architecture: ['amd64', 'arm64'],
      compatibilities: [
        {
          clusterVersion: '1.30',
          platformVersions: ['*'],
          defaultVersion: true,
        },
      ],
    },
  ],
  publisher: 'eks',
  owner: 'aws',
};

describe('modules/datasource/aws-eks-addon/index', () => {
  describe('getPkgReleases()', () => {
    it.each<{ des: string; req: DescribeAddonVersionsResponse }>`
      des               | req
      ${'null'}         | ${{}}
      ${'empty'}        | ${{ addons: [] }}
      ${'emptyVersion'} | ${{ addons: [{}] }}
    `('returned $des addons to be null', async ({ req }) => {
      mockDescribeAddonVersionsCommand(req);
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

    it('with addonName not supplied', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: '{"kubernetesVersion":"1.30"}',
      });
      expect(res).toBeNull();
      expect(logger.logger.warn).toHaveBeenCalledOnce();
    });

    it('with addonName only', async () => {
      mockDescribeAddonVersionsCommand({ addons: [addonInfo] });
      const res = await getPkgReleases({
        datasource,
        packageName: '{"addonName":"vpc-cni"}',
      });
      expect(res).toEqual({
        releases: [
          {
            version: 'v1.18.1-eksbuild.1',
            compatibleWith: ['1.30'],
            default: false,
          },
          {
            version: 'v1.18.2-eksbuild.1',
            compatibleWith: ['1.30'],
            default: true,
          },
          {
            version: 'v1.19.0-eksbuild.1',
            compatibleWith: ['1.31', '1.30', '1.29'],
            default: true,
          },
        ],
      });
      expect(eksMock.call(0).args[0].input).toEqual({
        addonName: 'vpc-cni',
        maxResults: 1,
      });
    });

    it('with addon and profile', async () => {
      mockDescribeAddonVersionsCommand({ addons: [] });
      await getPkgReleases({
        datasource,
        packageName: '{"addonName":"vpc-cni-not-exist", "profile":"paradox"}',
      });
      expect(eksMock.calls()).toHaveLength(1);
    });

    it('with addon and region', async () => {
      mockDescribeAddonVersionsCommand({ addons: [] });
      await getPkgReleases({
        datasource,
        packageName: '{"addonName":"vpc-cni-not-exist", "region":"usa"}',
      });
      expect(eksMock.calls()).toHaveLength(1);
    });

    it('with addonName and default only config', async () => {
      mockDescribeAddonVersionsCommand({ addons: [addonInfo] });
      const res = await getPkgReleases({
        datasource,
        packageName: '{"addonName":"vpc-cni", "default":true}',
      });
      expect(eksMock.call(0).args[0].input).toEqual({
        addonName: 'vpc-cni',
        maxResults: 1,
      });
      expect(res).toEqual({
        releases: [
          {
            version: 'v1.18.2-eksbuild.1',
            compatibleWith: ['1.30'],
            default: true,
          },
          {
            version: 'v1.19.0-eksbuild.1',
            compatibleWith: ['1.31', '1.30', '1.29'],
            default: true,
          },
        ],
      });
    });

    it('with matched addon to return all versions of the addon', async () => {
      const vpcCniAddonInfo: AddonInfo = {
        addonName: 'vpc-cni',
        type: 'networking',
        addonVersions: [
          {
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
          },
          {
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
          },
          // a bad addonVersion that's missing the basic fields.
          {},
        ],
        publisher: 'eks',
        owner: 'aws',
      };

      mockDescribeAddonVersionsCommandWithRegion({
        addons: [vpcCniAddonInfo],
      });
      const res = await getPkgReleases({
        datasource,
        packageName:
          '{"kubernetesVersion":"1.30","addonName":"vpc-cni","region":"mars-east-1"}',
      });
      expect(res).toEqual({
        releases: [
          {
            version: 'v1.18.1-eksbuild.1',
            compatibleWith: ['1.30'],
            default: false,
          },
          {
            version: 'v1.18.2-eksbuild.1',
            compatibleWith: ['1.30'],
            default: false,
          },
        ],
      });
      expect(eksMock.call(0).args[0].input).toEqual({
        kubernetesVersion: '1.30',
        addonName: 'vpc-cni',
        maxResults: 1,
      });
    });
  });
});
