const {
  extractAndUpdate,
} = require('../../../../lib/workers/repository/process/extract-update');
const updates = require('../../../../lib/workers/repository/updates');

jest.mock('../../../../lib/manager');
jest.mock('../../../../lib/workers/repository/updates');
jest.mock('../../../../lib/workers/repository/process/sort');
jest.mock('../../../../lib/workers/repository/process/write');

describe('workers/repository/process/extract-update', () => {
  describe('extractAndUpdate()', () => {
    it('runs', async () => {
      updates.determineUpdates.mockReturnValue({ repoIsOnboarded: true });
      await extractAndUpdate();
    });
  });
});
