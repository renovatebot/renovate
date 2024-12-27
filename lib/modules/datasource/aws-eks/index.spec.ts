import {
  DescribeClusterVersionsCommand,
  type DescribeClusterVersionsCommandOutput,
  EKSClient,
} from '@aws-sdk/client-eks';
import { mockClient } from 'aws-sdk-client-mock';
import { logger } from '../../../../test/util';
import { getPkgReleases } from '../index';
import { AwsEKSDataSource } from '.';

const datasource = AwsEKSDataSource.id;
const eksMock = mockClient(EKSClient);

function mockClusterVersionsResponse(
  input: DescribeClusterVersionsCommandOutput,
) {
  return eksMock.on(DescribeClusterVersionsCommand).resolves(input);
}

describe('modules/datasource/aws-eks/index', () => {
  beforeEach(() => {
    eksMock.reset();
  });

  describe('getReleases()', () => {
    it('should return releases when the response is valid', async () => {
      const mockResponse: DescribeClusterVersionsCommandOutput = {
        $metadata: {},
        clusterVersions: [
          {
            clusterVersion: '1.21',
            releaseDate: new Date(
              new Date().setMonth(new Date().getMonth() - 24),
            ),
            endOfStandardSupportDate: new Date(
              new Date().setMonth(new Date().getMonth() + 10),
            ),
          },
        ],
      };

      mockClusterVersionsResponse(mockResponse);

      const result = await getPkgReleases({ datasource, packageName: '{}' });

      expect(result?.releases).toHaveLength(1);
      expect(result).toEqual({
        releases: [
          {
            version: '1.21',
          },
        ],
      });

      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({});
    });

    it('should return null and log an error when the filter is invalid', async () => {
      const invalidFilter = '{ invalid json }';
      const actual = await getPkgReleases({
        datasource,
        packageName: invalidFilter,
      });
      expect(actual).toBeNull();
      expect(logger.logger.error).toHaveBeenCalledTimes(1);
    });

    it('should return default cluster only', async () => {
      const mockResponse: DescribeClusterVersionsCommandOutput = {
        $metadata: {},
        clusterVersions: [
          {
            clusterVersion: '1.31',
            defaultVersion: true,
            status: 'standard-support',
          },
        ],
      };
      mockClusterVersionsResponse(mockResponse);

      const actual = await getPkgReleases({
        datasource,
        packageName: '{"default":"true", "region":"eu-west-1"}',
      });

      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({ defaultOnly: true });

      expect(actual).toEqual({
        releases: [
          {
            version: '1.31',
          },
        ],
      });
    });

    it('should return default and non-default cluster when default:false', async () => {
      const mockResponse: DescribeClusterVersionsCommandOutput = {
        $metadata: {},
        clusterVersions: [
          {
            clusterVersion: '1.31',
            defaultVersion: true,
          },
          {
            clusterVersion: '1.30',
            defaultVersion: false,
          },
          {
            clusterVersion: '1.29',
            defaultVersion: false,
          },
        ],
      };
      mockClusterVersionsResponse(mockResponse);

      const actual = await getPkgReleases({
        datasource,
        packageName:
          '{"default":"false", "region":"eu-west-1", "profile":"admin"}',
      });

      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({ defaultOnly: false });

      expect(actual).toEqual({
        releases: [
          { version: '1.29' },
          { version: '1.30' },
          { version: '1.31' },
        ],
      });
    });

    it('should return empty response', async () => {
      const mockResponse: DescribeClusterVersionsCommandOutput = {
        $metadata: {},
        clusterVersions: [],
      };
      mockClusterVersionsResponse(mockResponse);

      const actual = await getPkgReleases({
        datasource,
        packageName: '{"profile":"not-exist-profile"}',
      });

      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({});
      expect(actual).toBeNull();
    });

    it('should return undefined response', async () => {
      const mockResponse: DescribeClusterVersionsCommandOutput = {
        $metadata: {},
        clusterVersions: undefined,
      };
      mockClusterVersionsResponse(mockResponse);

      const actual = await getPkgReleases({
        datasource,
        packageName: '{"profile":"not-exist-profile"}',
      });

      expect(eksMock.calls()).toHaveLength(1);
      expect(eksMock.call(0).args[0].input).toEqual({});
      expect(actual).toBeNull();
    });
  });
});
