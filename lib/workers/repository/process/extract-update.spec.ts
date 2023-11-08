import { logger, mocked, scm } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import type { BaseBranchCache } from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config';
import * as _branchify from '../updates/branchify';
import { extract, isCacheExtractValid, lookup, update } from './extract-update';

const createVulnerabilitiesMock = jest.fn();

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('./vulnerabilities', () => {
  return {
    __esModule: true,
    Vulnerabilities: class {
      static create() {
        return createVulnerabilitiesMock();
      }
    },
  };
});
jest.mock('../updates/branchify');
jest.mock('../extract');
jest.mock('../../../util/cache/repository');
jest.mock('../../../util/git');

const branchify = mocked(_branchify);
const repositoryCache = mocked(_repositoryCache);

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
    it('runs with no baseBranches', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test');
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

    it('runs with baseBranches', async () => {
      const config = {
        baseBranches: ['master', 'dev'],
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        enabledManagers: ['npm'],
        javascript: {
          labels: ['js'],
        },
        npm: {
          addLabels: 'npm',
        },
      };
      scm.checkoutBranch.mockResolvedValueOnce('123test');
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      const packageFiles = await extract(config);
      expect(packageFiles).toBeUndefined();
    });

    it('uses repository cache', async () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        baseBranch: 'master',
      };
      repositoryCache.getCache.mockReturnValueOnce({
        scan: {
          master: {
            sha: '123test',
            configHash: fingerprint(generateFingerprintConfig(config)),
            extractionFingerprints: {},
            packageFiles,
          },
        },
      });
      scm.getBranchCommit.mockResolvedValueOnce('123test');
      scm.checkoutBranch.mockResolvedValueOnce('123test');
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });

    it('fetches vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        osvVulnerabilityAlerts: true,
      };
      const appendVulnerabilityPackageRulesMock = jest.fn();
      createVulnerabilitiesMock.mockResolvedValueOnce({
        appendVulnerabilityPackageRules: appendVulnerabilityPackageRulesMock,
      });
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test');

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledOnce();
      expect(appendVulnerabilityPackageRulesMock).toHaveBeenCalledOnce();
    });

    it('handles exception when fetching vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        osvVulnerabilityAlerts: true,
      };
      createVulnerabilitiesMock.mockRejectedValueOnce(new Error());
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce('123test');

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledOnce();
    });
  });

  describe('isCacheExtractValid()', () => {
    let cachedExtract: BaseBranchCache;

    beforeEach(() => {
      cachedExtract = {
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
      const { extractionFingerprints, ...restOfCache } = cachedExtract;
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
