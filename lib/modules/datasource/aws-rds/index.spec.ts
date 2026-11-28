import type {
  DBEngineVersion,
  DescribeDBEngineVersionsCommandOutput,
} from '@aws-sdk/client-rds';
import {
  DescribeDBEngineVersionsCommand,
  RDSClient,
} from '@aws-sdk/client-rds';
import { mockClient } from 'aws-sdk-client-mock';
import * as hostRules from '../../../util/host-rules.ts';
import { getPkgReleases } from '../index.ts';
import { AwsRdsDatasource } from './index.ts';

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
        datasource: AwsRdsDatasource.id,
        packageName: '[{"Name":"engine","Values":["mysql"]}]',
      });
      expect(res).toBeNull();
    });

    it('with filter and profile', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
      });
      await getPkgReleases({
        datasource: AwsRdsDatasource.id,
        packageName:
          '[{"Name":"engine","Values":["mysql"]},{"profile":"paradox"}]',
      });
      expect(rdsMock.calls()).toHaveLength(1);
      expect(rdsMock.call(0).args[0].input).toEqual({
        Filters: [{ Name: 'engine', Values: ['mysql'] }],
      });
    });

    it('with filter and region', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
      });
      await getPkgReleases({
        datasource: AwsRdsDatasource.id,
        packageName:
          '[{"Name":"engine","Values":["mysql"]},{"region":"eu-central-1"}]',
      });
      expect(rdsMock.calls()).toHaveLength(1);
      const rds = rdsMock.call(0).thisValue as RDSClient;
      await expect(rds.config.region()).resolves.toBe('eu-central-1');
    });

    it('prefers host rule credentials over the configured profile', async () => {
      hostRules.add({
        hostType: AwsRdsDatasource.id,
        username: 'access-key-id',
        password: 'secret-access-key',
        token: 'session-token',
      });
      mockDescribeVersionsCommand({
        $metadata: {},
      });

      const awsRdsDatasource = new AwsRdsDatasource();
      await awsRdsDatasource.getReleases({
        packageName:
          '[{"Name":"engine","Values":["host-rule-credentials"]},{"profile":"ignored-profile"}]',
      });

      const rds = rdsMock.call(0).thisValue as RDSClient;
      await expect(rds.config.credentials()).resolves.toEqual({
        accessKeyId: 'access-key-id',
        secretAccessKey: 'secret-access-key',
        sessionToken: 'session-token',
        $source: {
          CREDENTIALS_CODE: 'e',
        },
      });
    });

    it('with one deprecated version', async () => {
      mockDescribeVersionsCommand({
        $metadata: {},
        DBEngineVersions: [version2],
      });
      const res = await getPkgReleases({
        datasource: AwsRdsDatasource.id,
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
        datasource: AwsRdsDatasource.id,
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

  describe('loadConfig()', () => {
    const rdsDatasource = new AwsRdsDatasource();

    it('loads filters without aws config', () => {
      const res = rdsDatasource.loadConfig(
        '[{"Name":"engine","Values":["mysql"]}]',
      );
      expect(res).toEqual([[{ Name: 'engine', Values: ['mysql'] }], {}]);
    });

    it('loads filters with multiple aws configs', () => {
      const res = rdsDatasource.loadConfig(
        '[{"Name":"engine","Values":["mysql"]},{"region":"us-west-2"},{"profile":"test-profile"},{"region":"eu-central-1"}]',
      );
      expect(res).toEqual([
        [{ Name: 'engine', Values: ['mysql'] }],
        { region: 'eu-central-1', profile: 'test-profile' },
      ]);
    });
  });
});
