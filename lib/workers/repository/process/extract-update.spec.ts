import { logger, scm } from '~test/util.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import * as _repositoryCache from '../../../util/cache/repository/index.ts';
import type { BaseBranchCache } from '../../../util/cache/repository/types.ts';
import { fingerprint } from '../../../util/fingerprint.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config.ts';
import * as _branchify from '../updates/branchify.ts';
import * as _fetch from './fetch.ts';
import {
  EXTRACT_CACHE_REVISION,
  extract,
  isCacheExtractValid,
  lookup,
  update,
} from './extract-update.ts';

const createVulnerabilitiesMock = vi.fn();

vi.mock('./write.ts');
vi.mock('./sort.ts');
vi.mock('./fetch.ts');
vi.mock('./vulnerabilities.ts', () => {
  return {
    __esModule: true,
    Vulnerabilities: class {
      static create() {
        return createVulnerabilitiesMock();
      }
    },
  };
});
vi.mock('../updates/branchify.ts');
vi.mock('../extract/index.ts');
vi.mock('../../../util/cache/repository/index.ts');

const branchify = vi.mocked(_branchify);
const repositoryCache = vi.mocked(_repositoryCache);
const fetch = vi.mocked(_fetch);

describe('workers/repository/process/extract-update', () => {
  beforeEach(() => {
    branchify.branchifyUpgrades.mockResolvedValue({
      branches: [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          baseBranch: 'base',
          upgrades: [],
        },
      ],
      branchList: ['branchName'],
    });
  });

  describe('extract()', () => {
    it('runs with no baseBranchPatterns', async () => {
      const config = {
        repoIsOnboarded: true,
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toEqual({
        branchList: ['branchName'],
        branches: [
          {
            branchName: 'some-branch',
            manager: 'some-manager',
            baseBranch: 'base',
            upgrades: [],
          },
        ],
        packageFiles: undefined,
      });
      await expect(update(config, res.branches)).resolves.not.toThrow();
    });

    it('runs with baseBranchPatterns', async () => {
      const config = {
        baseBranchPatterns: ['master', 'dev'],
        baseBranches: ['master', 'dev'],
        repoIsOnboarded: true,
        enabledManagers: ['npm'],
        javascript: {
          labels: ['js'],
        },
        npm: {
          addLabels: 'npm',
        },
      };
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      const packageFiles = await extract(config);
      expect(packageFiles).toBeUndefined();
    });

    it('uses repository cache', async () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const config = {
        repoIsOnboarded: true,
        baseBranch: 'master',
      };
      repositoryCache.getCache.mockReturnValueOnce({
        scan: {
          master: {
            revision: EXTRACT_CACHE_REVISION,
            sha: '123test',
            configHash: fingerprint(generateFingerprintConfig(config)),
            extractionFingerprints: {},
            packageFiles,
          },
        },
      });
      scm.getBranchCommit.mockResolvedValueOnce('123test' as LongCommitSha);
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });

    it('fetches vulnerabilities and flags malicious packages', async () => {
      const config = {
        repoIsOnboarded: true,
        osvVulnerabilityAlerts: true,
      };
      const appendVulnerabilityPackageRulesMock = vi.fn();
      const flagMaliciousPackagesMock = vi.fn();
      createVulnerabilitiesMock.mockResolvedValue({
        appendVulnerabilityPackageRules: appendVulnerabilityPackageRulesMock,
        flagMaliciousPackages: flagMaliciousPackagesMock,
      });
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledTimes(2);
      expect(
        appendVulnerabilityPackageRulesMock,
      ).toHaveBeenCalledExactlyOnceWith(
        {
          repoIsOnboarded: true,
          osvVulnerabilityAlerts: true,
        },
        undefined,
      );
      expect(flagMaliciousPackagesMock).toHaveBeenCalledExactlyOnceWith(
        {
          repoIsOnboarded: true,
          osvVulnerabilityAlerts: true,
        },
        undefined,
      );
    });

    it('handles exception when fetching vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        osvVulnerabilityAlerts: true,
      };
      createVulnerabilitiesMock.mockRejectedValue(new Error());
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledTimes(2);
    });

    describe('when skipReason=malicious-version-in-use', () => {
      it('logs a warning', async () => {
        const packageFiles: Record<string, PackageFile[]> = {
          npm: [
            {
              deps: [
                {
                  depType: 'devDependencies',
                  depName: 'axios',
                  currentValue: '1.14.1',
                  datasource: 'npm',
                  prettyDepType: 'devDependency',
                  lockedVersion: '1.14.1',
                  updates: [],
                  packageName: 'axios',

                  // most importantly
                  skipReason: 'malicious-version-in-use',
                },
                // not malicious
                {
                  depType: 'devDependencies',
                  depName: 'axios',
                  currentValue: '1.14.0',
                  datasource: 'npm',
                  prettyDepType: 'devDependency',
                  lockedVersion: '1.14.0',
                  updates: [],
                  packageName: 'axios',
                },
              ],
              packageFile: 'package.json',
            },
          ],
        };

        const config = {
          repoIsOnboarded: true,
          baseBranch: 'main',
        };

        await lookup(config, packageFiles);

        expect(logger.logger.warn).toHaveBeenCalledWith(
          {
            packageFile: 'package.json',
            depName: 'axios',
            packageName: 'axios',
            manager: 'npm',
            datasource: 'npm',
          },
          'Dependency axios is currently using a malicious version',
        );
      });

      it('deletes the skipReason and skipStage, to allow the update phase to continue updating', async () => {
        const packageFiles: Record<string, PackageFile[]> = {
          npm: [
            {
              deps: [
                {
                  depType: 'devDependencies',
                  depName: 'axios',
                  currentValue: '1.14.1',
                  datasource: 'npm',
                  prettyDepType: 'devDependency',
                  lockedVersion: '1.14.1',
                  updates: [],
                  packageName: 'axios',

                  // most importantly
                  skipReason: 'malicious-version-in-use',
                  skipStage: 'lookup',
                },
                // not malicious
                {
                  depType: 'devDependencies',
                  depName: 'axios',
                  currentValue: '1.14.0',
                  datasource: 'npm',
                  prettyDepType: 'devDependency',
                  lockedVersion: '1.14.0',
                  updates: [],
                  packageName: 'axios',
                },
              ],
              packageFile: 'package.json',
            },
          ],
        };

        const config = {
          repoIsOnboarded: true,
          baseBranch: 'main',
        };

        await lookup(config, packageFiles);

        expect(packageFiles.npm[0].deps[0].skipReason).toBeUndefined();
        expect(packageFiles.npm[0].deps[0].skipStage).toBeUndefined();
      });
    });

    it('when skipReason=malicious-update-proposed, it logs a warning for each skipReason', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              {
                depType: 'devDependencies',
                depName: 'axios',
                currentValue: '1.14.0',
                datasource: 'npm',
                prettyDepType: 'devDependency',
                lockedVersion: '1.14.0',
                updates: [
                  {
                    newVersion: '1.14.1',
                  },
                  {
                    // unrelated, using newValue
                    newValue: '1.14.2',
                  },
                  {
                    // unrelated
                    newVersion: '2.0.0',
                  },
                  {
                    // doesn't have a newVersion or newValue
                    updateType: 'digest',
                    newDigest: '1234',
                  },
                ],
                packageName: 'axios',

                // most importantly
                skipReason: 'malicious-update-proposed',
              },
              // not malicious
              {
                depType: 'devDependencies',
                depName: 'axios',
                currentValue: '1.14.0',
                datasource: 'npm',
                prettyDepType: 'devDependency',
                lockedVersion: '1.14.0',
                updates: [],
                packageName: 'axios',
              },
            ],
            packageFile: 'package.json',
          },
        ],
      };

      const config = {
        repoIsOnboarded: true,
        baseBranch: 'main',
      };

      await lookup(config, packageFiles);

      expect(logger.logger.warn).toHaveBeenCalledWith(
        {
          packageFile: 'package.json',
          depName: 'axios',
          packageName: 'axios',
          manager: 'npm',
          datasource: 'npm',
          newVersions: ['1.14.1', '1.14.2', '2.0.0'],
        },
        'Dependency axios has update(s) proposed which would update you to a malicious version - skipping',
      );
    });

    it('flags malicious packages after updates have been fetched, so that proposed malicious updates can be detected', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            deps: [
              {
                depType: 'devDependencies',
                depName: 'axios',
                currentValue: '1.14.0',
                datasource: 'npm',
                prettyDepType: 'devDependency',
                lockedVersion: '1.14.0',
                packageName: 'axios',
              },
            ],
            packageFile: 'package.json',
          },
        ],
      };

      const config = {
        repoIsOnboarded: true,
        baseBranch: 'main',
        osvVulnerabilityAlerts: true,
      };

      // Simulate fetchUpdates populating `updates` on each dep,
      // the way the real implementation does.
      fetch.fetchUpdates.mockImplementation(async (_config, pkgs) => {
        for (const files of Object.values(pkgs!)) {
          for (const file of files) {
            for (const dep of file.deps) {
              dep.updates = [{ newVersion: '1.14.1' }];
            }
          }
        }
      });

      // Capture what the malicious-package flagging step sees when it runs.
      let depsSeenByFlagMalicious: any;
      const appendVulnerabilityPackageRulesMock = vi.fn();
      const flagMaliciousPackagesMock = vi.fn(
        async (_config: any, pkgs: any) => {
          depsSeenByFlagMalicious = structuredClone(pkgs.npm[0].deps);
        },
      );
      createVulnerabilitiesMock.mockResolvedValue({
        appendVulnerabilityPackageRules: appendVulnerabilityPackageRulesMock,
        flagMaliciousPackages: flagMaliciousPackagesMock,
      });

      await lookup(config, packageFiles);

      expect(flagMaliciousPackagesMock).toHaveBeenCalled();
      expect(depsSeenByFlagMalicious[0].updates).toEqual([
        { newVersion: '1.14.1' },
      ]);
    });
  });

  describe('isCacheExtractValid()', () => {
    let cachedExtract: BaseBranchCache;

    beforeEach(() => {
      cachedExtract = {
        revision: EXTRACT_CACHE_REVISION,
        sha: 'sha',
        configHash: undefined as never,
        extractionFingerprints: {},
        packageFiles: {},
      };
    });

    it('undefined cache', () => {
      expect(isCacheExtractValid('sha', 'hash', undefined)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('returns false if no revision', () => {
      delete cachedExtract.revision;
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('returns false if revision mismatch', () => {
      cachedExtract.revision = -1;
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('partial cache', () => {
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('sha mismatch', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('new_sha', 'hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Cached extract result cannot be used due to base branch SHA change (old=sha, new=new_sha)`,
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('config change', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'new_hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract result cannot be used due to config change',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('invalid if no extractionFingerprints', () => {
      cachedExtract.configHash = 'hash';
      const { extractionFingerprints: _, ...restOfCache } = cachedExtract;
      expect(
        isCacheExtractValid(
          'sha',
          'hash',
          restOfCache as never as BaseBranchCache,
        ),
      ).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract is missing extractionFingerprints, so cannot be used',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('invalid if changed fingerprints', () => {
      cachedExtract.configHash = 'hash';
      cachedExtract.extractionFingerprints = { npm: 'old-fingerprint' };
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('valid cache and config', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(true);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract for sha=sha is valid and can be used',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });
  });
});
