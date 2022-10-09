import type { Osv, OsvOffline } from '@renovatebot/osv-offline';
import { mockFn } from 'jest-mock-extended';
import { RenovateConfig, getConfig } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import { Vulnerabilities } from './vulnerabilities';

const getVulnerabilitiesMock =
  mockFn<typeof OsvOffline.prototype.getVulnerabilities>();
const createMock = jest.fn();

jest.mock('@renovatebot/osv-offline', () => {
  return {
    __esModule: true,
    OsvOffline: class {
      static create() {
        return createMock();
      }
    },
  };
});

describe('workers/repository/process/vulnerabilities', () => {
  describe('create()', () => {
    it('works', async () => {
      await expect(Vulnerabilities.create()).resolves.not.toThrow();
    });

    it('throws when osv-offline error', async () => {
      createMock.mockRejectedValue(new Error());

      await expect(Vulnerabilities.create()).rejects.toThrow();
    });
  });

  describe('fetchVulnerabilities()', () => {
    let config: RenovateConfig;
    let vulnerabilities: Vulnerabilities;
    const lodashVulnerability: Osv.Vulnerability = {
      id: 'GHSA-x5rq-j2xg-h7qm',
      modified: new Date(),
      affected: [
        {
          ranges: [
            {
              type: 'SEMVER',
              events: [{ introduced: '0.0.0' }, { fixed: '4.17.11' }],
            },
          ],
          package: { name: 'lodash', ecosystem: 'npm' },
        },
      ],
      references: [
        {
          type: 'ADVISORY',
          url: 'https://nvd.nist.gov/vuln/detail/CVE-2019-1010266',
        },
      ],
    };

    beforeAll(async () => {
      createMock.mockResolvedValue({
        getVulnerabilities: getVulnerabilitiesMock,
      });
      vulnerabilities = await Vulnerabilities.create();
    });

    beforeEach(() => {
      config = getConfig();
      // Why does this not reset?
      config.packageRules = [];
    });

    it('returns no packageRules when no vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(0);
    });

    it('returns no packageRules for unsupported datasource', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [{ deps: [{ depName: 'node', datasource: 'docker' }] }],
      };

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(0);
    });

    it('filters out not applicable vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.11', datasource: 'npm' },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([lodashVulnerability]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(0);
    });

    it('returns a single packageRule', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([lodashVulnerability]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toIncludeAllPartialMembers([
        {
          allowedVersions: '4.17.11',
          isVulnerabilityAlert: true,
          matchPackageNames: ['lodash'],
        },
      ]);
    });

    it('returns multiple packageRules when multiple vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        lodashVulnerability,
        {
          id: 'GHSA-p6mc-m468-83gw',
          modified: new Date(),
          affected: [
            {
              ranges: [
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0' }, { fixed: '4.17.20' }],
                },
              ],
              package: { name: 'lodash', ecosystem: 'npm' },
            },
          ],
        },
      ]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(2);
      expect(config.packageRules).toIncludeAllPartialMembers([
        {
          allowedVersions: '4.17.11',
          isVulnerabilityAlert: true,
          matchPackageNames: ['lodash'],
        },
        {
          allowedVersions: '4.17.20',
          isVulnerabilityAlert: true,
          matchPackageNames: ['lodash'],
        },
      ]);
    });

    it('returns a single packageRule for regex manager', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([lodashVulnerability]);

      await vulnerabilities.fetchVulnerabilities(config, packageFiles);

      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toIncludeAllPartialMembers([
        {
          allowedVersions: '4.17.11',
          isVulnerabilityAlert: true,
          matchPackageNames: ['lodash'],
        },
      ]);
    });
  });
});
