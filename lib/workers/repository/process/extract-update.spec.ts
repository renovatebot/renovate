import { extractAndUpdate } from './extract-update';
import * as _branchify from '../updates/branchify';
import { mocked } from '../../../../test/util';

jest.mock('./write');
jest.mock('./sort');
jest.mock('./fetch');
jest.mock('../updates/branchify');
jest.mock('../extract');

const branchify = mocked(_branchify);

branchify.branchifyUpgrades.mockResolvedValueOnce({
  branches: [],
  branchList: [],
});

describe('workers/repository/process/extract-update', () => {
  describe('extractAndUpdate()', () => {
    it('runs', async () => {
      const config = {
        repoIsOnboarded: true,
        suppressNotifications: ['deprecationWarningIssues'],
      };
      await extractAndUpdate(config);
    });
  });
});
