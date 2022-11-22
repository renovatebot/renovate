import { git, logger, mocked } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import type { BaseBranchCache } from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config';
import * as _branchify from '../updates/branchify';
import { extract, isCacheExtractValid, lookup, update } from './extract-update';

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../updates/branchify');
jest.mock('../extract');
jest.mock('../../../util/cache/repository');
jest.mock('../../../util/git');

const branchify = mocked(_branchify);
const repositoryCache = mocked(_repositoryCache);

branchify.branchifyUpgrades.mockResolvedValueOnce({
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

describe('workers/repository/process/extract-update', () => {
  describe('extract()', () => {
    it('runs with no baseBranches', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      git.checkoutBranch.mockResolvedValueOnce('123test');
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
      git.checkoutBranch.mockResolvedValueOnce('123test');
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
            packageFiles,
          },
        },
      });
      git.getBranchCommit.mockReturnValueOnce('123test');
      git.checkoutBranch.mockResolvedValueOnce('123test');
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });
  });

  describe('isCacheExtractValid()', () => {
    let cachedExtract: BaseBranchCache = undefined as never;

    it('undefined cache', () => {
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('partial cache', () => {
      cachedExtract = {
        sha: 'sha',
        configHash: undefined as never,
        packageFiles: {},
      };
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('sha mismatch', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('new_sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Cached extract result cannot be used due to base branch SHA change (old=sha, new=new_sha)`
      );
    });

    it('config change', () => {
      cachedExtract.sha = 'sha';
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'new_hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract result cannot be used due to config change'
      );
    });

    it('valid cache and config', () => {
      cachedExtract.sha = 'sha';
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(true);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract for sha=sha is valid and can be used'
      );
    });
  });
});
