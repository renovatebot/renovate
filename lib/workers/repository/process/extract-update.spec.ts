import hash from 'object-hash';
import { mocked } from '../../../../test/util';
import * as _repositoryCache from '../../../util/cache/repository';
import * as _branchify from '../updates/branchify';
import { extract, lookup, update } from './extract-update';

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../updates/branchify');
jest.mock('../extract');
jest.mock('../../../util/cache/repository');

const branchify = mocked(_branchify);
const repositoryCache = mocked(_repositoryCache);

branchify.branchifyUpgrades.mockResolvedValueOnce({
  branches: [{ branchName: 'some-branch', upgrades: [] }],
  branchList: ['branchName'],
});

describe('workers/repository/process/extract-update', () => {
  describe('extract()', () => {
    it('runs', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      repositoryCache.getCache.mockReturnValueOnce({});
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toMatchSnapshot();
      await expect(update(config, res.branches)).resolves.not.toThrow();
    });
    it('uses repository cache', async () => {
      const packageFiles = [];
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
        baseBranch: 'master',
        baseBranchSha: 'abc123',
      };
      repositoryCache.getCache.mockReturnValueOnce({
        extract: {
          master: {
            sha: config.baseBranchSha,
            configHash: hash(config).toString(),
            packageFiles,
          },
        },
      });
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });
  });
});
