import hasha from 'hasha';
import { git, mocked } from '../../../../test/util';
import type { PackageFile } from '../../../modules/manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import * as _branchify from '../update/branchify';
import { extract, lookup, update } from './extract-update';

jest.mock('../update/write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../update/branchify');
jest.mock('../extract');
jest.mock('../../../util/cache/repository');
jest.mock('../../../util/git');

const branchify = mocked(_branchify);
const repositoryCache = mocked(_repositoryCache);

branchify.branchifyUpgrades.mockResolvedValueOnce({
  branches: [{ branchName: 'some-branch', upgrades: [] }],
  branchList: ['branchName'],
});

describe('workers/repository/lookup/extract-update', () => {
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
            configHash: hasha(JSON.stringify(config)),
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
});
