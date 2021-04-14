import hasha from 'hasha';
import { getName, git, mocked } from '../../../../test/util';
import type { PackageFile } from '../../../manager/types';
import * as _repositoryCache from '../../../util/cache/repository';
import * as _branchify from '../updates/branchify';
import { extract, lookup, update } from './extract-update';

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
  branches: [{ branchName: 'some-branch', upgrades: [] }],
  branchList: ['branchName'],
});

describe(getName(__filename), () => {
  describe('extract()', () => {
    it('runs with no baseBranches', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      git.checkoutBranch.mockResolvedValueOnce('abc123');
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toMatchSnapshot();
      await expect(update(config, res.branches)).resolves.not.toThrow();
    });
    it('runs with baseBranches', async () => {
      const config = {
        baseBranches: ['master', 'dev'],
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      git.checkoutBranch.mockResolvedValueOnce('abc123');
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      const packageFiles = await extract(config);
      expect(packageFiles).toMatchSnapshot();
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
            sha: 'abc123',
            configHash: hasha(JSON.stringify(config)),
            packageFiles,
          },
        },
      });
      git.getBranchCommit.mockReturnValueOnce('abc123');
      git.checkoutBranch.mockResolvedValueOnce('abc123');
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });
  });
});
