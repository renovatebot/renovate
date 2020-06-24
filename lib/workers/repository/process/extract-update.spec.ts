import { mocked } from '../../../../test/util';
import * as _branchify from '../updates/branchify';
import { extract, lookup, update } from './extract-update';

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../updates/branchify');
jest.mock('../extract');

const branchify = mocked(_branchify);

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
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toMatchSnapshot();
      await expect(update(config, res.branches)).resolves.not.toThrow();
    });
  });
});
