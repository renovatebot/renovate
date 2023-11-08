import {
  DBEngineVersion,
  DescribeDBEngineVersionsCommand,
  DescribeDBEngineVersionsCommandOutput,
  RDSClient,
} from '@aws-sdk/client-rds';
import { mockClient } from 'aws-sdk-client-mock';
import { getPkgReleases } from '..';
import { AwsRdsDataSource } from '.';

const rdsMock = mockClient(RDSClient);

const version1: DBEngineVersion = {
  Engine: 'mysql',
  EngineVersion: '8.0.26',
  DBParameterGroupFamily: 'mysql8.0',
  DBEngineDescription: 'MySQL Community Edition',
  DBEngineVersionDescription: 'MySQL 8.0.26',
  ValidUpgradeTarget: [
    {
      Engine: 'mysql',
      EngineVersion: '8.0.27',
      Description: 'MySQL 8.0.27',
      AutoUpgrade: false,
      IsMajorVersionUpgrade: false,
    },
    {
      Engine: 'mysql',
      EngineVersion: '8.0.28',
      Description: 'MySQL 8.0.28',
      AutoUpgrade: false,
      IsMajorVersionUpgrade: false,
    },
  ],
  ExportableLogTypes: ['audit', 'error', 'general', 'slowquery'],
  SupportsLogExportsToCloudwatchLogs: true,
  SupportsReadReplica: true,
  SupportedFeatureNames: [],
  Status: 'available',
  SupportsParallelQuery: false,
  SupportsGlobalDatabases: false,
  MajorEngineVersion: '8.0',
  SupportsBabelfish: false,
};

const version2: DBEngineVersion = {
  Engine: 'mysql',
  EngineVersion: '8.0.27',
  DBParameterGroupFamily: 'mysql8.0',
  DBEngineDescription: 'MySQL Community Edition',
  DBEngineVersionDescription: 'MySQL 8.0.27',
  ValidUpgradeTarget: [
    {
      Engine: 'mysql',
      EngineVersion: '8.0.28',
      Description: 'MySQL 8.0.28',
      AutoUpgrade: false,
      IsMajorVersionUpgrade: false,
    },
  ],
  ExportableLogTypes: ['audit', 'error', 'general', 'slowquery'],
  SupportsLogExportsToCloudwatchLogs: true,
  SupportsReadReplica: true,
  SupportedFeatureNames: [],
  Status: 'deprecated',
  SupportsParallelQuery: false,
  SupportsGlobalDatabases: false,
  MajorEngineVersion: '8.0',
  SupportsBabelfish: false,
};

const version3: DBEngineVersion = {
  Engine: 'mysql',
  EngineVersion: '8.0.28',
  DBParameterGroupFamily: 'mysql8.0',
  DBEngineDescription: 'MySQL Community Edition',
  DBEngineVersionDescription: 'MySQL 8.0.28',
  ValidUpgradeTarget: [],
  ExportableLogTypes: ['audit', 'error', 'general', 'slowquery'],
  SupportsLogExportsToCloudwatchLogs: true,
  SupportsReadReplica: true,
  SupportedFeatureNames: [],
  Status: 'available',
  SupportsParallelQuery: false,
  SupportsGlobalDatabases: false,
  MajorEngineVersion: '8.0',
  SupportsBabelfish: false,
};

function mockDescribeVersionsCommand(
  result: DescribeDBEngineVersionsCommandOutput,
): void {
  rdsMock.on(DescribeDBEngineVersionsCommand).resolves(result);
}

describe('modules/datasource/aws-rds/index', () => {
  beforeEach(() => {
    rdsMock.reset();
  });

  describe('getPkgReleases()', () => {
    it('without returned versions', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
      });
      const res = await getPkgReleases({
        datasource: AwsRdsDataSource.id,
        packageName: '[{"Name":"engine","Values":["mysql"]}]',
      });
      expect(res).toBeNull();
    });

    it('with one deprecated version', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
        DBEngineVersions: [version2],
      });
      const res = await getPkgReleases({
        datasource: AwsRdsDataSource.id,
        packageName: '[{"Name":"engine","Values":["mysql"]}]',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: true,
            version: version2.EngineVersion,
          },
        ],
      });
    });

    it('with 3 matching versions', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
        DBEngineVersions: [version1, version2, version3],
      });
      const res = await getPkgReleases({
        datasource: AwsRdsDataSource.id,
        packageName: '[{"Name":"engine","Values":["mysql"]}]',
      });
      expect(res).toEqual({
        releases: [
          {
            isDeprecated: false,
            version: version1.EngineVersion,
          },
          {
            isDeprecated: true,
            version: version2.EngineVersion,
          },
          {
            isDeprecated: false,
            version: version3.EngineVersion,
          },
        ],
      });
    });
  });
});
