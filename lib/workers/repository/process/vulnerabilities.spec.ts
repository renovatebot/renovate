import type { Osv, OsvOffline } from '@renovatebot/osv-offline';
import { codeBlock } from 'common-tags';
import { mockFn } from 'jest-mock-extended';
import { RenovateConfig, logger } from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
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

    beforeAll(async () => {
      createMock.mockResolvedValue({
        getVulnerabilities: getVulnerabilitiesMock,
      });
      vulnerabilities = await Vulnerabilities.create();
    });

    beforeEach(() => {
      config = getConfig();
      config.packageRules = [];
    });

    it('return list of Vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        poetry: [
          {
            deps: [
              { depName: 'django', currentValue: '3.2', datasource: 'pypi' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-qrw5-5h28-modded',
          modified: '',
          affected: [
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '3.0' }, { fixed: '3.3.8' }],
                },
              ],
            },
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '3.2' }, { fixed: '3.2.16' }],
                },
              ],
            },
          ],
        },
      ]);

      const vulnerabilityList = await vulnerabilities.fetchVulnerabilities(
        config,
        packageFiles,
      );
      expect(vulnerabilityList).toMatchObject([
        {
          packageName: 'django',
          depVersion: '3.2',
          fixedVersion: '==3.3.8',
          datasource: 'pypi',
        },
        {
          packageName: 'django',
          depVersion: '3.2',
          fixedVersion: '==3.2.16',
          datasource: 'pypi',
        },
      ]);
    });
  });

  describe('appendVulnerabilityPackageRules()', () => {
    let config: RenovateConfig;
    let vulnerabilities: Vulnerabilities;
    const lodashVulnerability: Osv.Vulnerability = {
      id: 'GHSA-x5rq-j2xg-h7qm',
      modified: '',
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
      config.packageRules = [];
    });

    it('unsupported datasource', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        dockerfile: [
          {
            deps: [{ depName: 'node', datasource: 'docker' }],
            packageFile: 'some-file',
          },
        ],
      };

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'Cannot map datasource docker to OSV ecosystem',
      );
    });

    it('package found but no vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [{ depName: 'lodash', datasource: 'npm' }],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'No vulnerabilities found in OSV database for lodash',
      );
    });

    it('vulnerability without affected field', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.11', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-p6mc-m468-83gw',
          modified: '',
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(0);
    });

    it('withdrawn vulnerability', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          ...lodashVulnerability,
          withdrawn: '2021-11-29T18:17:00Z',
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'Skipping withdrawn vulnerability GHSA-x5rq-j2xg-h7qm',
      );
      expect(config.packageRules).toHaveLength(0);
    });

    it('invalid dep version', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              {
                depName: 'lodash',
                currentValue: '#4.17.11',
                datasource: 'npm',
              },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([lodashVulnerability]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Skipping vulnerability lookup for package lodash due to unsupported version #4.17.11',
      );
    });

    it('exception while fetching vulnerabilities', async () => {
      const err = new Error('unknown');
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'some-file',
            deps: [
              {
                depName: 'lodash',
                currentValue: '4.17.11',
                datasource: 'npm',
              },
            ],
          },
        ],
      };
      getVulnerabilitiesMock.mockRejectedValueOnce(err);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { err },
        'Error fetching vulnerability information for lodash',
      );
    });

    it('log event with invalid version', async () => {
      const event = { fixed: '^6.0' };
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              {
                depName: 'lodash',
                currentValue: '4.17.11',
                datasource: 'npm',
              },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              package: {
                name: 'lodash',
                ecosystem: 'npm',
                purl: 'pkg:npm/lodash',
              },
              ranges: [
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0' }, event],
                },
              ],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { event },
        'Skipping OSV event with invalid version',
      );
    });

    it('no version or range affected', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'fake', currentValue: '4.17.11', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              package: { name: 'fake', ecosystem: 'npm', purl: 'pkg:npm/fake' },
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(0);
    });

    it('no fixed version available', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'fake', currentValue: '4.17.11', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              package: { name: 'fake', ecosystem: 'npm', purl: 'pkg:npm/fake' },
              versions: ['4.17.11'],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.info).toHaveBeenCalledWith(
        'No fixed version available for vulnerability GHSA-xxxx-yyyy-zzzz in fake 4.17.11',
      );
    });

    it('does not accidentally downgrade versions due to fixed version for other range', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'fake', currentValue: '1.5.1', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              ranges: [
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0' }, { fixed: '1.1.0' }],
                },
                {
                  type: 'SEMVER',
                  events: [{ introduced: '1.3.0' }],
                },
              ],
              package: { name: 'fake', ecosystem: 'npm' },
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.info).toHaveBeenCalledWith(
        'No fixed version available for vulnerability GHSA-xxxx-yyyy-zzzz in fake 1.5.1',
      );
    });

    it('vulnerability with multiple unsorted events', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        gomod: [
          {
            deps: [
              { depName: 'stdlib', currentValue: '1.7.5', datasource: 'go' },
            ],
            packageFile: 'some-file',
          },
        ],
      };

      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GO-2022-0187',
          modified: '',
          aliases: ['CVE-2017-8932'],
          affected: [
            {
              package: {
                name: 'stdlib',
                ecosystem: 'Go',
                purl: 'pkg:golang/stdlib',
              },
              ranges: [
                {
                  type: 'SEMVER',
                  events: [
                    { introduced: '1.6.0' },
                    { fixed: '1.8.5' },
                    { introduced: '1.8.3' },
                    { fixed: '1.7.6' },
                  ],
                },
              ],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Vulnerability GO-2022-0187 affects stdlib 1.7.5',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Setting allowed version 1.7.6 to fix vulnerability GO-2022-0187 in stdlib 1.7.5',
      );
      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['go'],
          matchPackageNames: ['stdlib'],
          matchCurrentVersion: '1.7.5',
          allowedVersions: '1.7.6',
          isVulnerabilityAlert: true,
        },
      ]);
    });

    it('vulnerability with multiple affected entries and version ranges', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        poetry: [
          {
            deps: [
              { depName: 'django', currentValue: '3.2', datasource: 'pypi' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-qrw5-5h28-modded',
          modified: '',
          affected: [
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'GIT',
                  repo: 'https://github.com/django/django',
                  events: [
                    { introduced: '0' },
                    { fixed: '5b6b257fa7ec37ff27965358800c67e2dd11c924' },
                  ],
                },
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '3.2' }, { fixed: '3.2.16' }],
                },
              ],
              versions: ['3.2.1', '3.2.10', '3.2.9'],
            },
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '4.0' }, { fixed: '4.0.8' }],
                },
              ],
              versions: ['4.0', '4.0.1', '4.0.6', '4.0.7'],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['pypi'],
          matchPackageNames: ['django'],
          matchCurrentVersion: '3.2',
          allowedVersions: '==3.2.16',
          isVulnerabilityAlert: true,
        },
      ]);
    });

    it('package rules are sorted by fixed version even if affected is unsorted', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        poetry: [
          {
            deps: [
              { depName: 'django', currentValue: '3.2', datasource: 'pypi' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-qrw5-5h28-modded',
          modified: '',
          affected: [
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '3.0' }, { fixed: '3.3.8' }],
                },
              ],
            },
            {
              package: {
                name: 'django',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/django',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '3.2' }, { fixed: '3.2.16' }],
                },
              ],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(2);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['pypi'],
          matchPackageNames: ['django'],
          matchCurrentVersion: '3.2',
          allowedVersions: '==3.2.16',
          isVulnerabilityAlert: true,
        },
        {
          matchDatasources: ['pypi'],
          matchPackageNames: ['django'],
          matchCurrentVersion: '3.2',
          allowedVersions: '==3.3.8',
          isVulnerabilityAlert: true,
        },
      ]);
    });

    it('filters not applicable vulnerability', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.11', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([lodashVulnerability]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(0);
    });

    it('returns a single packageRule for regex manager', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            deps: [
              {
                depName: 'tiny_http',
                currentValue: '0.1.2',
                datasource: 'crate',
              },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'RUSTSEC-2020-0031',
          summary:
            'HTTP Request smuggling through malformed Transfer Encoding headers',
          details:
            'HTTP pipelining issues and request smuggling attacks are possible due to incorrect Transfer encoding header parsing.\n\nIt is possible conduct HTTP request smuggling attacks (CL:TE/TE:TE) by sending invalid Transfer Encoding headers.\n\nBy manipulating the HTTP response the attacker could poison a web-cache, perform an XSS attack, or obtain sensitive information from requests other than their own.',
          aliases: ['CVE-2020-35884', 'SOME-1234-5678'],
          modified: '',
          affected: [
            {
              package: {
                name: 'tiny_http',
                ecosystem: 'crates.io',
                purl: 'pkg:cargo/tiny_http',
              },
              ranges: [
                {
                  type: 'SEMVER',
                  events: [
                    { introduced: '0' },
                    { fixed: '0.6.3' },
                    { introduced: '0.7.0-0' },
                    { fixed: '0.8.0' },
                  ],
                },
              ],
            },
          ],
          severity: [
            {
              type: 'CVSS_V2',
              score: 'AV:N/AC:L/Au:N/C:P/I:P/A:N',
            },
            {
              type: 'CVSS_V3',
              score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N',
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );

      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['crate'],
          matchPackageNames: ['tiny_http'],
          matchCurrentVersion: '0.1.2',
          allowedVersions: '0.6.3',
          isVulnerabilityAlert: true,
          prBodyNotes: [
            '\n\n' +
              codeBlock`
              ---

              ### HTTP Request smuggling through malformed Transfer Encoding headers
              [CVE-2020-35884](https://nvd.nist.gov/vuln/detail/CVE-2020-35884) / [RUSTSEC-2020-0031](https://rustsec.org/advisories/RUSTSEC-2020-0031.html) / SOME-1234-5678

              <details>
              <summary>More information</summary>

              #### Details
              HTTP pipelining issues and request smuggling attacks are possible due to incorrect Transfer encoding header parsing.

              It is possible conduct HTTP request smuggling attacks (CL:TE/TE:TE) by sending invalid Transfer Encoding headers.

              By manipulating the HTTP response the attacker could poison a web-cache, perform an XSS attack, or obtain sensitive information from requests other than their own.

              #### Severity
              - CVSS Score: 6.5 / 10 (Medium)
              - Vector String: \`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N\`

              #### References
              No references.

              This data is provided by [OSV](https://osv.dev/vulnerability/RUSTSEC-2020-0031) and the [Rust Advisory Database](https://github.com/RustSec/advisory-db) ([CC0 1.0](https://github.com/rustsec/advisory-db/blob/main/LICENSE.txt)).
              </details>
            `,
          ],
        },
      ]);
    });

    it('returns multiple packageRules for different vulnerabilities', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        lodashVulnerability,
        {
          id: 'GHSA-p6mc-m468-83gw',
          modified: '',
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
          severity: [
            {
              type: 'CVSS_V3',
              score: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:H',
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );

      expect(config.packageRules).toHaveLength(2);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['lodash'],
          matchCurrentVersion: '4.17.10',
          allowedVersions: '4.17.11',
          isVulnerabilityAlert: true,
        },
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['lodash'],
          matchCurrentVersion: '4.17.10',
          allowedVersions: '4.17.20',
          isVulnerabilityAlert: true,
        },
      ]);
    });

    it('filters not applicable vulnerability based on last_affected version', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        poetry: [
          {
            deps: [
              { depName: 'quokka', currentValue: '1.2.3', datasource: 'pypi' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              package: {
                name: 'quokka',
                ecosystem: 'PyPI',
                purl: 'pkg:pypi/quokka',
              },
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '0' }, { last_affected: '0.4.0' }],
                },
              ],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(logger.logger.debug).not.toHaveBeenCalledWith(
        'OSV advisory GHSA-xxxx-yyyy-zzzz lists quokka 1.2.3 as vulnerable',
      );
      expect(config.packageRules).toHaveLength(0);
    });

    it('returns packageRule based on last_affected version', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '0.5.0', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'GHSA-xxxx-yyyy-zzzz',
          modified: '',
          affected: [
            {
              package: {
                name: 'lodash',
                ecosystem: 'npm',
                purl: 'pkg:npm/lodash',
              },
              ranges: [
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0' }, { last_affected: '0.2.0' }],
                },
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0.4.0' }, { last_affected: '0.8.0' }],
                },
              ],
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );
      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['lodash'],
          matchCurrentVersion: '0.5.0',
          allowedVersions: '> 0.8.0',
          isVulnerabilityAlert: true,
          prBodyNotes: [
            '\n\n' +
              codeBlock`
              ---

              ### [GHSA-xxxx-yyyy-zzzz](https://github.com/advisories/GHSA-xxxx-yyyy-zzzz)

              <details>
              <summary>More information</summary>

              #### Details
              No details.

              #### Severity
              Unknown

              #### References
              No references.

              This data is provided by [OSV](https://osv.dev/vulnerability/GHSA-xxxx-yyyy-zzzz) and the [GitHub Advisory Database](https://github.com/github/advisory-database) ([CC-BY 4.0](https://github.com/github/advisory-database/blob/main/LICENSE.md)).
              </details>
            `,
          ],
        },
      ]);
    });

    it('handles invalid CVSS scores gracefully', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        poetry: [
          {
            deps: [
              {
                depName: 'django-mfa2',
                currentValue: '2.5.0',
                datasource: 'pypi',
              },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'PYSEC-2022-303',
          modified: '',
          affected: [
            {
              ranges: [
                {
                  type: 'ECOSYSTEM',
                  events: [{ introduced: '0' }, { fixed: '2.5.1' }],
                },
              ],
              package: { name: 'django-mfa2', ecosystem: 'PyPI' },
            },
          ],
          severity: [
            {
              type: 'CVSS_V3',
              score: 'some-invalid-score',
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Error processing CVSS vector some-invalid-score',
      );
      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['pypi'],
          matchPackageNames: ['django-mfa2'],
          matchCurrentVersion: '2.5.0',
          allowedVersions: '==2.5.1',
          isVulnerabilityAlert: true,
          prBodyNotes: [
            '\n\n' +
              codeBlock`
              ---

              ### PYSEC-2022-303

              <details>
              <summary>More information</summary>

              #### Details
              No details.

              #### Severity
              - CVSS Score: Unknown
              - Vector String: \`some-invalid-score\`

              #### References
              No references.

              This data is provided by [OSV](https://osv.dev/vulnerability/PYSEC-2022-303) and the [PyPI Advisory Database](https://github.com/pypa/advisory-database) ([CC-BY 4.0](https://github.com/pypa/advisory-database/blob/main/LICENSE)).
              </details>
            `,
          ],
        },
      ]);
    });

    it('show severity text in GHSA advisories without CVSS score', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              { depName: 'lodash', currentValue: '4.17.10', datasource: 'npm' },
            ],
            packageFile: 'some-file',
          },
        ],
      };

      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          ...lodashVulnerability,
          database_specific: {
            severity: 'MODERATE',
          },
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );

      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['npm'],
          matchPackageNames: ['lodash'],
          matchCurrentVersion: '4.17.10',
          allowedVersions: '4.17.11',
          isVulnerabilityAlert: true,
          prBodyNotes: [
            '\n\n' +
              codeBlock`
              ---

              ### [GHSA-x5rq-j2xg-h7qm](https://github.com/advisories/GHSA-x5rq-j2xg-h7qm)

              <details>
              <summary>More information</summary>

              #### Details
              No details.

              #### Severity
              Moderate

              #### References
              - [https://nvd.nist.gov/vuln/detail/CVE-2019-1010266](https://nvd.nist.gov/vuln/detail/CVE-2019-1010266)

              This data is provided by [OSV](https://osv.dev/vulnerability/GHSA-x5rq-j2xg-h7qm) and the [GitHub Advisory Database](https://github.com/github/advisory-database) ([CC-BY 4.0](https://github.com/github/advisory-database/blob/main/LICENSE.md)).
              </details>
            `,
          ],
        },
      ]);
    });

    it('formats headings of vulnerability details', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            deps: [
              {
                depName: 'sys-info',
                currentValue: '0.6.0',
                datasource: 'crate',
              },
            ],
            packageFile: 'some-file',
          },
        ],
      };
      getVulnerabilitiesMock.mockResolvedValueOnce([
        {
          id: 'RUSTSEC-2020-0100',
          summary:
            'Double free when calling `sys_info::disk_info` from multiple threads',
          details:
            'Affected versions of `sys-info` use a static, global, list to store temporary disk information while running. The function that cleans up this list,\n`DFCleanup`, assumes a single threaded environment and will try to free the same memory twice in a multithreaded environment.\n\nThis results in consistent double-frees and segfaults when calling `sys_info::disk_info` from multiple threads at once.\n\nThe issue was fixed by moving the global variable into a local scope.\n\n## Safer Alternatives:\n - [`sysinfo`](https://crates.io/crates/sysinfo)',
          aliases: ['CVE-2020-36434'],
          modified: '',
          affected: [
            {
              package: {
                name: 'sys-info',
                ecosystem: 'crates.io',
                purl: 'pkg:cargo/sys-info',
              },
              ranges: [
                {
                  type: 'SEMVER',
                  events: [{ introduced: '0.0.0-0' }, { fixed: '0.8.0' }],
                },
              ],
              database_specific: {
                cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
              },
            },
          ],
        },
      ]);

      await vulnerabilities.appendVulnerabilityPackageRules(
        config,
        packageFiles,
      );

      expect(config.packageRules).toHaveLength(1);
      expect(config.packageRules).toMatchObject([
        {
          matchDatasources: ['crate'],
          matchPackageNames: ['sys-info'],
          matchCurrentVersion: '0.6.0',
          allowedVersions: '0.8.0',
          isVulnerabilityAlert: true,
          prBodyNotes: [
            '\n\n' +
              codeBlock`
              ---

              ### Double free when calling \`sys_info::disk_info\` from multiple threads
              [CVE-2020-36434](https://nvd.nist.gov/vuln/detail/CVE-2020-36434) / [RUSTSEC-2020-0100](https://rustsec.org/advisories/RUSTSEC-2020-0100.html)

              <details>
              <summary>More information</summary>

              #### Details
              Affected versions of \`sys-info\` use a static, global, list to store temporary disk information while running. The function that cleans up this list,
              \`DFCleanup\`, assumes a single threaded environment and will try to free the same memory twice in a multithreaded environment.

              This results in consistent double-frees and segfaults when calling \`sys_info::disk_info\` from multiple threads at once.

              The issue was fixed by moving the global variable into a local scope.

              ##### Safer Alternatives:
               - [\`sysinfo\`](https://crates.io/crates/sysinfo)

              #### Severity
              - CVSS Score: 9.8 / 10 (Critical)
              - Vector String: \`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H\`

              #### References
              No references.

              This data is provided by [OSV](https://osv.dev/vulnerability/RUSTSEC-2020-0100) and the [Rust Advisory Database](https://github.com/RustSec/advisory-db) ([CC0 1.0](https://github.com/rustsec/advisory-db/blob/main/LICENSE.txt)).
              </details>
            `,
          ],
        },
      ]);
    });
  });
});
