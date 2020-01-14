import { extractAndUpdate } from '../../../../lib/workers/repository/process/extract-update';
import * as _branchify from '../../../../lib/workers/repository/updates/branchify';
import { mocked } from '../../../util';

jest.mock('../../../../lib/workers/repository/process/write');
jest.mock('../../../../lib/workers/repository/process/sort');
jest.mock('../../../../lib/workers/repository/process/fetch');
jest.mock('../../../../lib/workers/repository/updates/branchify');
jest.mock('../../../../lib/workers/repository/extract');

const branchify = mocked(_branchify);

branchify.branchifyUpgrades.mockReturnValueOnce({});

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
