import type { S3Client } from '@aws-sdk/client-s3';
import { mock, mockDeep } from 'vitest-mock-extended';
import type { RenovateConfig } from '../config/types';
import type { PackageFile } from '../modules/manager/types';
import type { BranchCache } from '../util/cache/repository/types';
import {
  addBranchStats,
  addExtractionStats,
  addLibYears,
  exportStats,
  finalizeReport,
  getReport,
  resetReport,
} from './reporting';
import type { Report } from './types';
import { s3 } from '~test/s3';
import { fs, logger } from '~test/util';

vi.mock('../util/fs', () => mockDeep());
vi.mock('../util/s3', () => mockDeep());
vi.mock('../logger', () => mockDeep());

describe('instrumentation/reporting', () => {
  beforeEach(() => {
    resetReport();
  });

  const branchInformation: Partial<BranchCache>[] = [
    {
      branchName: 'a-branch-name',
      prNo: 20,
      upgrades: [
        {
          currentVersion: '21.1.1',
          currentValue: 'v21.1.1',
          newVersion: '22.0.0',
          newValue: 'v22.0.0',
        },
      ],
    },
  ];
  const packageFiles: Record<string, PackageFile[]> = {
    terraform: [
      {
        packageFile: 'terraform/versions.tf',
        deps: [
          {
            currentValue: 'v21.1.1',
            currentVersion: '4.4.3',
            updates: [
              {
                bucket: 'non-major',
                newVersion: '4.7.0',
                newValue: '~> 4.7.0',
              },
            ],
          },
        ],
      },
    ],
  };

  const expectedReport: Report = {
    problems: [],
    repositories: {
      'myOrg/myRepo': {
        problems: [],
        branches: branchInformation,
        packageFiles,
      },
    },
  };

  it('return empty report if no stats have been added', () => {
    const config = {};
    addBranchStats(config, []);
    addExtractionStats(config, {
      branchList: [],
      branches: [],
      packageFiles: {},
    });
    addLibYears(config, {
      libYears: { managers: {}, total: 0 },
      dependencyStatus: { outdated: 0, total: 0 },
    });

    expect(getReport()).toEqual({
      problems: [],
      repositories: {},
    });
  });

  it('return report if reportType is set to logging', () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'logging',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    expect(getReport()).toEqual(expectedReport);
  });

  it('log report if reportType is set to logging', async () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'logging',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    await exportStats(config);
    expect(logger.logger.info).toHaveBeenCalledWith(
      { report: expectedReport },
      'Printing report',
    );
  });

  it('write report if reportType is set to file', async () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'file',
      reportPath: './report.json',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    await exportStats(config);
    expect(fs.writeSystemFile).toHaveBeenCalledWith(
      config.reportPath,
      JSON.stringify(expectedReport),
    );
  });

  it('send report to an S3 bucket if reportType is s3', async () => {
    const mockClient = mock<S3Client>();
    s3.parseS3Url.mockReturnValue({ Bucket: 'bucket-name', Key: 'key-name' });
    s3.getS3Client.mockReturnValue(mockClient);

    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 's3',
      reportPath: 's3://bucket-name/key-name',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    await exportStats(config);
    expect(mockClient.send.mock.calls[0][0]).toMatchObject({
      input: {
        Body: JSON.stringify(expectedReport),
      },
    });
  });

  it('handle failed parsing of S3 url', async () => {
    s3.parseS3Url.mockReturnValue(null);

    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 's3',
      reportPath: 'aPath',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    await exportStats(config);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      { reportPath: config.reportPath },
      'Failed to parse s3 URL',
    );
  });

  it('catch exception', async () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'file',
      reportPath: './report.json',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    fs.writeSystemFile.mockRejectedValue(null);
    await expect(exportStats(config)).toResolve();
  });

  it('should add problems to report', () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'logging',
    };
    const expectedReport = {
      problems: [
        {
          level: 30,
          msg: 'a root problem',
        },
      ],
      repositories: {
        'myOrg/myRepo': {
          problems: [
            {
              level: 30,
              msg: 'a repo problem',
            },
          ],
          branches: branchInformation,
          packageFiles,
        },
      },
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });

    logger.getProblems.mockReturnValue([
      {
        repository: 'myOrg/myRepo',
        level: 30,
        msg: 'a repo problem',
      },
      {
        level: 30,
        msg: 'a root problem',
      },
    ]);
    finalizeReport();

    expect(getReport()).toEqual(expectedReport);
  });

  it('should handle libyears addition', () => {
    const config: RenovateConfig = {
      repository: 'myOrg/myRepo',
      reportType: 'logging',
    };

    addBranchStats(config, branchInformation);
    addExtractionStats(config, { branchList: [], branches: [], packageFiles });
    addLibYears(config, {
      libYears: { managers: { npm: 1 }, total: 1 },
      dependencyStatus: { outdated: 1, total: 1 },
    });

    expect(getReport()).toEqual({
      problems: [],
      repositories: {
        'myOrg/myRepo': {
          problems: [],
          branches: branchInformation,
          packageFiles,
          libYearsWithStatus: {
            libYears: {
              managers: {
                npm: 1,
              },
              total: 1,
            },
            dependencyStatus: {
              outdated: 1,
              total: 1,
            },
          },
        },
      },
    });
  });
});
