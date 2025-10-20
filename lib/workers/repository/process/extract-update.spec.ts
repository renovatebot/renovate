import type { PackageFile } from '../../../modules/manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import type { BaseBranchCache } from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import type { LongCommitSha } from '../../../util/git/types';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config';
import * as _branchify from '../updates/branchify';
import {
  EXTRACT_CACHE_REVISION,
  extract,
  isCacheExtractValid,
  lookup,
  update,
} from './extract-update';
import { logger, scm } from '~test/util';

const createVulnerabilitiesMock = vi.fn();

vi.mock('./write');
vi.mock('./sort');
vi.mock('./fetch');
vi.mock('./vulnerabilities', () => {
  return {
    __esModule: true,
    Vulnerabilities: class {
      static create() {
        return createVulnerabilitiesMock();
      }
    },
  };
});
vi.mock('../updates/branchify');
vi.mock('../extract');
vi.mock('../../../util/cache/repository');

const branchify = vi.mocked(_branchify);
const repositoryCache = vi.mocked(_repositoryCache);

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

    it('fetches vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        osvVulnerabilityAlerts: true,
      };
      const appendVulnerabilityPackageRulesMock = vi.fn();
      createVulnerabilitiesMock.mockResolvedValueOnce({
        appendVulnerabilityPackageRules: appendVulnerabilityPackageRulesMock,
      });
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledExactlyOnceWith();
      expect(
        appendVulnerabilityPackageRulesMock,
      ).toHaveBeenCalledExactlyOnceWith(
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
      createVulnerabilitiesMock.mockRejectedValueOnce(new Error());
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test' as LongCommitSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledExactlyOnceWith();
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
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Cached extract result cannot be used due to base branch SHA change (old=sha, new=new_sha)`,
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('config change', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'new_hash', cachedExtract)).toBe(false);
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract result cannot be used due to config change',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('invalid if no extractionFingerprints', () => {
      cachedExtract.configHash = 'hash';
      const { extractionFingerprints, ...restOfCache } = cachedExtract;
      expect(
        isCacheExtractValid(
          'sha',
          'hash',
          restOfCache as never as BaseBranchCache,
        ),
      ).toBe(false);
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
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
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract for sha=sha is valid and can be used',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });
  });
});
